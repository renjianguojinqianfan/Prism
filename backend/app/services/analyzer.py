import json
import re
from typing import AsyncGenerator

import httpx

from app.schemas import AnalyzerMessage

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


def build_analyzer_prompt(topic: str, prior_messages: list[AnalyzerMessage], your_message: str) -> str:
    """构造发言者自评 prompt。前文最多取最近 5 条避免上下文过长。"""
    recent = prior_messages[-5:]
    prior_text = "\n\n".join(f"{m.modelName}：{m.content}" for m in recent) or "（无前文，这是首条发言）"
    return _ANALYZER_PROMPT_TEMPLATE.format(
        topic=topic or "未指定话题",
        prior_messages=prior_text,
        your_message=your_message,
    )


async def stream_self_eval(
    client: httpx.AsyncClient,
    endpoint: str,
    api_key: str,
    payload: dict,
) -> AsyncGenerator[str, None]:
    """用注入的 httpx client 调用 LLM 流式接口，解析 SSE 并产出 Prism 协议事件。
    client 由路由层通过 Depends(get_llm_client) 注入，便于测试替换。
    失败（HTTP 非 200 / 解析失败 / 网络错误）→ 推 fallback event。
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
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
