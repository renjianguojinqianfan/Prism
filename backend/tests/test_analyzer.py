import json
from typing import AsyncIterator

import httpx

from app.schemas import AnalyzerMessage
from app.services.analyzer import _parse_label_json, build_analyzer_prompt, stream_self_eval


# ===========================================================================
# _parse_label_json
# ===========================================================================


def test_parse_label_json_standard():
    text = '{"label":"consensus","evidence":"观点一致"}'
    assert _parse_label_json(text) == {"label": "consensus", "evidence": "观点一致"}


def test_parse_label_json_with_surrounding_text():
    text = '分析结果：{"label":"divergence","evidence":"立场对立"} 希望有帮助。'
    assert _parse_label_json(text) == {"label": "divergence", "evidence": "立场对立"}


def test_parse_label_json_code_block_wrapped():
    text = '```json\n{"label":"neutral","evidence":"新角度"}\n```'
    assert _parse_label_json(text) == {"label": "neutral", "evidence": "新角度"}


def test_parse_label_json_no_label_field():
    assert _parse_label_json('{"evidence":"无标签"}') is None


def test_parse_label_json_invalid_label_value():
    # label 不在白名单 {consensus, divergence, neutral}
    assert _parse_label_json('{"label":"agree","evidence":"x"}') is None


def test_parse_label_json_broken_json():
    # 缺引号，非法 JSON
    assert _parse_label_json('{label: consensus}') is None


def test_parse_label_json_missing_evidence():
    # 有 label 但缺 evidence → 返回 evidence=""
    assert _parse_label_json('{"label":"consensus"}') == {"label": "consensus", "evidence": ""}


def test_parse_label_json_multiple_blocks_picks_first_with_label():
    # 含 label 的第一个块胜出
    text = '{"foo":1} 然后 {"label":"neutral","evidence":"x"}'
    assert _parse_label_json(text) == {"label": "neutral", "evidence": "x"}


def test_parse_label_json_empty_string():
    assert _parse_label_json("") is None


# ===========================================================================
# build_analyzer_prompt
# ===========================================================================


def test_build_prompt_no_prior_messages():
    prompt = build_analyzer_prompt("话题", [], "我的发言")
    assert "（无前文，这是首条发言）" in prompt
    assert "话题" in prompt
    assert "我的发言" in prompt


def test_build_prompt_truncates_to_last_five():
    priors = [
        AnalyzerMessage(id=str(i), modelName=f"M{i}", content=f"内容{i}") for i in range(6)
    ]
    prompt = build_analyzer_prompt("话题", priors, "新发言")
    # 前 5 条（索引 0-4）被截断，只保留最后 5 条（索引 1-5）
    assert "M0" not in prompt
    assert "M1" in prompt
    assert "M5" in prompt


def test_build_prompt_empty_topic():
    prompt = build_analyzer_prompt("", [], "发言")
    assert "未指定话题" in prompt


def test_build_prompt_all_placeholders_filled():
    priors = [AnalyzerMessage(id="1", modelName="DeepSeek", content="前文观点")]
    prompt = build_analyzer_prompt("AI伦理", priors, "我赞同")
    assert "AI伦理" in prompt
    assert "DeepSeek" in prompt
    assert "前文观点" in prompt
    assert "我赞同" in prompt


# ===========================================================================
# stream_self_eval（异步；用 httpx.MockTransport 控制流式响应）
# ===========================================================================

_ENDPOINT = "https://llm.test/v1/chat/completions"
_API_KEY = "sk-test"


def _sse_data(delta: str = "") -> bytes:
    """构造一个含 delta content 的 OpenAI SSE data 行（含尾部 \\n\\n）。"""
    payload = {"choices": [{"delta": {"content": delta}}]}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


def _sse_done() -> bytes:
    return b"data: [DONE]\n\n"


def _static_client(body: bytes, status: int = 200) -> httpx.AsyncClient:
    """MockTransport 返回静态 body 的 client（aiter_text 通常一次吐出全部）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, content=body)
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _streaming_client(chunks: list[bytes], status: int = 200) -> httpx.AsyncClient:
    """MockTransport 按给定 chunks 流式返回（控制 aiter_text 的分块边界）。"""
    def handler(request: httpx.Request) -> httpx.Response:
        async def gen() -> AsyncIterator[bytes]:
            for c in chunks:
                yield c
        return httpx.Response(
            status,
            stream=httpx._content.AsyncIteratorByteStream(gen()),
        )
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _raising_client(exc: Exception) -> httpx.AsyncClient:
    """MockTransport 直接抛异常，模拟网络/超时错误。"""
    def handler(request: httpx.Request) -> httpx.Response:
        raise exc
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def _collect(client: httpx.AsyncClient, payload: dict | None = None) -> list[dict]:
    """收集 stream_self_eval 产生的事件并解析为 dict。"""
    events: list[dict] = []
    async for raw in stream_self_eval(client, _ENDPOINT, _API_KEY, payload or {}):
        assert raw.startswith("data: ")
        events.append(json.loads(raw[6:].strip()))
    return events


async def test_stream_happy_path_delta_then_final():
    label_json = '{"label":"consensus","evidence":"观点一致"}'
    body = _sse_data(label_json) + _sse_done()
    client = _static_client(body)
    events = await _collect(client)

    deltas = [e for e in events if e["type"] == "delta"]
    finals = [e for e in events if e["type"] == "final"]
    assert len(deltas) == 1
    assert deltas[0]["content"] == label_json
    assert len(finals) == 1
    assert finals[0] == {"type": "final", "label": "consensus", "evidence": "观点一致"}


async def test_stream_parse_failed_fallback():
    # delta 累积为非法 JSON（无 label 字段）→ 末尾 fallback parse_failed
    body = _sse_data("这只是一段普通文字，没有JSON") + _sse_done()
    client = _static_client(body)
    events = await _collect(client)

    finals = [e for e in events if e["type"] == "fallback"]
    assert len(finals) == 1
    assert finals[0] == {"type": "fallback", "reason": "parse_failed"}


async def test_stream_http_404_fallback():
    client = _static_client(b"not found", status=404)
    events = await _collect(client)
    assert events == [{"type": "fallback", "reason": "http_404"}]


async def test_stream_http_500_fallback():
    client = _static_client(b"server error", status=500)
    events = await _collect(client)
    assert events == [{"type": "fallback", "reason": "http_500"}]


async def test_stream_done_line_skipped():
    # 仅 [DONE]，无 delta → full 为空 → parse_failed
    client = _static_client(_sse_done())
    events = await _collect(client)
    deltas = [e for e in events if e["type"] == "delta"]
    assert deltas == []
    assert events[-1] == {"type": "fallback", "reason": "parse_failed"}


async def test_stream_chunk_split_across_buffer_boundary():
    # 把单条 data: 行切成两半，验证 buffer 拼接逻辑
    label_json = '{"label":"neutral","evidence":"拼接OK"}'
    full_line = _sse_data(label_json)  # 含尾部 \n\n
    mid = len(full_line) // 2
    client = _streaming_client([full_line[:mid], full_line[mid:], _sse_done()])
    events = await _collect(client)

    deltas = [e for e in events if e["type"] == "delta"]
    finals = [e for e in events if e["type"] == "final"]
    assert len(deltas) == 1
    assert deltas[0]["content"] == label_json
    assert len(finals) == 1
    assert finals[0]["label"] == "neutral"


async def test_stream_network_error_fallback():
    client = _raising_client(httpx.HTTPError("connection reset"))
    events = await _collect(client)
    assert events == [{"type": "fallback", "reason": "network_error"}]


async def test_stream_timeout_fallback():
    client = _raising_client(httpx.TimeoutException("read timeout"))
    events = await _collect(client)
    assert events == [{"type": "fallback", "reason": "network_error"}]
