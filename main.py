# 棱镜 (Prism) 后端主入口：
# - GET  /api/health            健康检查
# - POST /api/analyze           Jaccard 关键词启发式分析（同步回退）
# - POST /api/analyze/stream    发言者自评 SSE 流式分析（主路径，失败回退 /api/analyze）
import json
import os
import re
from typing import AsyncGenerator, Literal

import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


app = FastAPI(title="Prism Backend", version="0.1.0")

ALLOWED_ORIGINS = os.getenv(
    "PRISM_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# ---------- Pydantic 模型 ----------

class Message(BaseModel):
    id: str
    modelName: str
    content: str


class AnalyzeRequest(BaseModel):
    topic: str = ""
    messages: list[Message] = Field(default_factory=list)


class Tag(BaseModel):
    id: str
    label: Literal["consensus", "divergence", "neutral"]
    score: float
    evidence: str


class AnalyzeResponse(BaseModel):
    tags: list[Tag]


class AnalyzerMessage(BaseModel):
    """流式分析中的单条消息。model 用于后端按 model 名匹配 PRISM_ANALYZER_API_KEYS 中的 endpoint + Key。
    不接受前端传入的 endpoint，避免 SSRF 与 Key 泄漏（C1 修复）。
    """
    id: str
    modelName: str
    model: str = ""        # 模型标识，后端据此从 PRISM_ANALYZER_API_KEYS 查 endpoint+Key
    content: str


class StreamAnalyzeRequest(BaseModel):
    topic: str = ""
    currentMessage: AnalyzerMessage
    priorMessages: list[AnalyzerMessage] = Field(default_factory=list)


# ---------- 启发式分析 ----------

# 中英常见停用词最小集
_STOPWORDS: set[str] = {
    # 中文
    "的", "是", "了", "和", "与", "并", "就", "也", "在", "对", "从", "把", "被",
    "我", "你", "他", "她", "它", "我们", "你们", "他们", "这", "那", "这个", "那个",
    "但", "而", "或", "如果", "因为", "所以", "一个", "一种", "可以", "需要", "进行",
    # 英文
    "a", "an", "the", "and", "or", "but", "of", "to", "for", "in", "on", "at",
    "is", "are", "was", "were", "be", "been", "being", "this", "that", "these",
    "those", "it", "as", "by", "with", "from", "we", "you", "they", "i", "he", "she",
}


def _is_cjk(ch: str) -> bool:
    if not ch:
        return False
    cp = ord(ch)
    # 常见中日韩统一表意文字范围
    return (
        0x4E00 <= cp <= 0x9FFF
        or 0x3400 <= cp <= 0x4DBF
        or 0xF900 <= cp <= 0xFAFF
    )


def _tokenize(text: str) -> set[str]:
    """简单分词：英文按空格切分；中文用 1-2 字滑窗。保留长度 >= 2 且不在停用词表中的 token。"""
    tokens: set[str] = set()
    if not text:
        return tokens

    # 1) 英文/数字 token：按非字母数字切分
    buf: list[str] = []
    cjk_chars: list[str] = []

    def flush_ascii() -> None:
        if buf:
            word = "".join(buf).lower()
            if len(word) >= 2 and word not in _STOPWORDS:
                tokens.add(word)
            buf.clear()

    def flush_cjk() -> None:
        # 中文：1-gram（长度>=2 才保留实际不会触发，因为 1-gram 长度=1）+ 2-gram
        # 这里仅生成 2-gram，保证 token 长度>=2
        if len(cjk_chars) >= 2:
            for i in range(len(cjk_chars) - 1):
                bigram = cjk_chars[i] + cjk_chars[i + 1]
                if bigram not in _STOPWORDS:
                    tokens.add(bigram)
        cjk_chars.clear()

    for ch in text:
        if _is_cjk(ch):
            flush_ascii()
            cjk_chars.append(ch)
        elif ch.isalnum():
            flush_cjk()
            buf.append(ch)
        else:
            flush_ascii()
            flush_cjk()

    flush_ascii()
    flush_cjk()

    return tokens


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    if union == 0:
        return 0.0
    return inter / union


def analyze(messages: list[Message], topic: str) -> list[Tag]:
    if not messages:
        return []

    n = len(messages)
    keywords: list[set[str]] = [_tokenize(m.content) for m in messages]

    # 单条消息：直接 neutral
    if n == 1:
        return [
            Tag(
                id=messages[0].id,
                label="neutral",
                score=0.0,
                evidence="仅一条发言，默认为中立",
            )
        ]

    # 两两 Jaccard
    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            s = _jaccard(keywords[i], keywords[j])
            sim[i][j] = s
            sim[j][i] = s

    high = 0.14
    low = 0.11

    tags: list[Tag] = []
    for i in range(n):
        avg = sum(sim[i][j] for j in range(n) if j != i) / (n - 1)
        score = round(avg, 3)
        if avg >= high:
            label: Literal["consensus", "divergence", "neutral"] = "consensus"
            evidence = f"与其他 {n - 1} 条发言关键词重合度 {score}"
        elif avg <= low:
            label = "divergence"
            evidence = "与其他发言显著分歧"
        else:
            label = "neutral"
            evidence = f"与其他 {n - 1} 条发言关键词重合度 {score}，处于中立区间"

        tags.append(
            Tag(
                id=messages[i].id,
                label=label,
                score=score,
                evidence=evidence,
            )
        )

    return tags


# ---------- 流式自评分析 ----------

# 分析者 system prompt 模板：让发言者自己评估刚才的发言与前文的关系
_ANALYZER_PROMPT_TEMPLATE = """你是一个观点分析助手。你刚刚参与了关于「{topic}」的讨论，现在需要分析自己刚才的发言与前文其他参与者的发言之间的关系。

前文参与者发言：
{prior_messages}

你刚才的发言：
{your_message}

请判断你的发言与前文整体的关系：
- consensus（共识）：你的观点与前文多数观点方向一致或补充支持
- divergence（分歧）：你的观点与前文有明显对立、反驳或不同立场
- neutral（中立）：你的发言是新角度、新信息或方向拓展，无明显共识/分歧

只输出 JSON，不要任何额外文字：
{{"label": "consensus|divergence|neutral", "evidence": "一句话证据，不超过50字"}}
"""


def _load_analyzer_keys() -> dict[str, dict[str, str]]:
    """从 PRISM_ANALYZER_API_KEYS 加载分析配置池。
    返回 {model_name: {"endpoint": url, "key": api_key}}。
    解析失败返回空 dict（调用方会回退 Jaccard）。

    环境变量 JSON 结构示例：
    {"deepseek-chat":{"endpoint":"https://api.deepseek.com/v1/chat/completions","key":"sk-xxx"}}

    C1 修复：endpoint 与 Key 都由后端环境变量统一管理，前端只传 model 名，
    避免前端可控 endpoint 触发 SSRF 与 Key 泄漏。
    """
    raw = os.getenv("PRISM_ANALYZER_API_KEYS", "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            result: dict[str, dict[str, str]] = {}
            for k, v in data.items():
                if isinstance(v, dict) and v.get("endpoint") and v.get("key"):
                    result[str(k)] = {"endpoint": str(v["endpoint"]), "key": str(v["key"])}
            return result
    except (json.JSONDecodeError, ValueError):
        pass
    return {}


def _parse_label_json(text: str) -> dict | None:
    """容错解析 LLM 输出为 {label, evidence}。
    优先匹配包含 "label" 字段的 JSON 块；不强制 JSON mode 以保证兼容性。
    """
    m = re.search(r'\{[^{}]*"label"[^{}]*\}', text)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
        if obj.get("label") in ("consensus", "divergence", "neutral"):
            return {"label": obj["label"], "evidence": str(obj.get("evidence", ""))}
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def _build_analyzer_prompt(topic: str, prior_messages: list[AnalyzerMessage], your_message: str) -> str:
    """构造发言者自评 prompt。前文最多取最近 5 条避免上下文过长。"""
    recent = prior_messages[-5:]
    prior_text = "\n\n".join(f"{m.modelName}：{m.content}" for m in recent) or "（无前文，这是首条发言）"
    return _ANALYZER_PROMPT_TEMPLATE.format(
        topic=topic or "未指定话题",
        prior_messages=prior_text,
        your_message=your_message,
    )


# ---------- 路由 ----------

@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_endpoint(req: AnalyzeRequest) -> AnalyzeResponse:
    tags = analyze(req.messages, req.topic)
    return AnalyzeResponse(tags=tags)


@app.post("/api/analyze/stream")
async def analyze_stream(req: StreamAnalyzeRequest) -> StreamingResponse:
    """SSE 流式自评分析：后端按 model 名从 PRISM_ANALYZER_API_KEYS 查 endpoint+Key，
    用发言者自己的 LLM 做评估，流式推回。
    Key 找不到 / 调用失败 / 解析失败 → 推 fallback event，前端收到后回退 /api/analyze。

    C1 修复：endpoint 不再来自前端，统一由后端环境变量白名单提供，杜绝 SSRF 与 Key 泄漏。
    """
    cur = req.currentMessage
    pool = _load_analyzer_keys()
    cfg = pool.get(cur.model)  # {"endpoint": url, "key": api_key}

    # 无配置 → 立即回退（不区分 endpoint/key 缺失，避免暴露内部状态）
    if not cfg or not cfg.get("endpoint") or not cfg.get("key"):
        async def fallback_no_key() -> AsyncGenerator[str, None]:
            yield 'data: {"type":"fallback","reason":"no_key"}\n\n'
        return StreamingResponse(fallback_no_key(), media_type="text/event-stream")

    endpoint = cfg["endpoint"]
    api_key = cfg["key"]

    prompt = _build_analyzer_prompt(req.topic, req.priorMessages, cur.content)
    payload = {
        "model": cur.model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
        "temperature": 0.3,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async def stream_llm() -> AsyncGenerator[str, None]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream("POST", endpoint, headers=headers, json=payload) as resp:
                    if resp.status_code != 200:
                        yield f'data: {{"type":"fallback","reason":"http_{resp.status_code}"}}\n\n'
                        return
                    buffer = ""
                    full = ""
                    async for chunk in resp.aiter_text():
                        buffer += chunk
                        lines = buffer.split("\n")
                        buffer = lines.pop() or ""
                        for line in lines:
                            line = line.strip()
                            if not line.startswith("data: "):
                                continue
                            data = line[6:]
                            if data == "[DONE]":
                                continue
                            try:
                                obj = json.loads(data)
                                delta = obj.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            except (json.JSONDecodeError, ValueError, IndexError):
                                continue
                            if delta:
                                full += delta
                                yield f'data: {json.dumps({"type":"delta","content":delta}, ensure_ascii=False)}\n\n'
                    # 流结束，解析最终 JSON
                    parsed = _parse_label_json(full)
                    if parsed:
                        yield f'data: {json.dumps({"type":"final","label":parsed["label"],"evidence":parsed["evidence"]}, ensure_ascii=False)}\n\n'
                    else:
                        yield 'data: {"type":"fallback","reason":"parse_failed"}\n\n'
        except (httpx.TimeoutException, httpx.HTTPError):
            yield 'data: {"type":"fallback","reason":"network_error"}\n\n'

    return StreamingResponse(stream_llm(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PRISM_PORT", "8000")),
        reload=True,
    )
