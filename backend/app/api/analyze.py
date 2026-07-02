from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import get_llm_client
from app.config import load_analyzer_keys
from app.schemas import AnalyzeRequest, AnalyzeResponse, StreamAnalyzeRequest
from app.services.analyzer import build_analyzer_prompt, stream_self_eval
from app.services.heuristic import analyze

router = APIRouter()


@router.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_endpoint(req: AnalyzeRequest) -> AnalyzeResponse:
    tags = analyze(req.messages, req.topic)
    return AnalyzeResponse(tags=tags)


@router.post("/api/analyze/stream")
async def analyze_stream(
    req: StreamAnalyzeRequest,
    client: httpx.AsyncClient = Depends(get_llm_client),
) -> StreamingResponse:
    """SSE 流式自评分析：后端按 model 名从 PRISM_ANALYZER_API_KEYS 查 endpoint+Key，
    用发言者自己的 LLM 做评估，流式推回。
    Key 找不到 / 调用失败 / 解析失败 → 推 fallback event，前端收到后回退 /api/analyze。

    C1 修复：endpoint 不再来自前端，统一由后端环境变量白名单提供，杜绝 SSRF 与 Key 泄漏。
    """
    cur = req.currentMessage
    pool = load_analyzer_keys()
    cfg = pool.get(cur.model)  # {"endpoint": url, "key": api_key}

    # 无配置 → 立即回退（不区分 endpoint/key 缺失，避免暴露内部状态）
    if not cfg or not cfg.get("endpoint") or not cfg.get("key"):
        async def fallback_no_key() -> AsyncGenerator[str, None]:
            yield 'data: {"type":"fallback","reason":"no_key"}\n\n'
        return StreamingResponse(fallback_no_key(), media_type="text/event-stream")

    endpoint = cfg["endpoint"]
    api_key = cfg["key"]

    prompt = build_analyzer_prompt(req.topic, req.priorMessages, cur.content)
    payload = {
        "model": cur.model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
        "temperature": 0.3,
    }

    return StreamingResponse(
        stream_self_eval(client, endpoint, api_key, payload),
        media_type="text/event-stream",
    )
