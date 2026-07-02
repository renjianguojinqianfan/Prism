import json

import httpx
import respx

_LLM_URL = "https://llm.test/v1/chat/completions"
_KEY_POOL = {"deepseek-chat": {"endpoint": _LLM_URL, "key": "sk-test"}}


def _sse_data(delta: str = "") -> bytes:
    payload = {"choices": [{"delta": {"content": delta}}]}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


def _sse_done() -> bytes:
    return b"data: [DONE]\n\n"


def _parse_events(text: str) -> list[dict]:
    """从 SSE 响应文本中提取所有 data 事件并解析为 dict。"""
    events = []
    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


def _stream_body() -> dict:
    """构造一个合法的 /api/analyze/stream 请求体。"""
    return {
        "topic": "AI伦理",
        "currentMessage": {
            "id": "1",
            "modelName": "DeepSeek",
            "model": "deepseek-chat",
            "content": "我赞同谨慎推进",
        },
        "priorMessages": [],
    }


# ---------------------------------------------------------------------------
# 无 Key 回退路径
# ---------------------------------------------------------------------------


def test_stream_no_key_returns_no_key_fallback(client, patch_analyzer_keys):
    patch_analyzer_keys(None)  # 清空环境变量
    resp = client.post("/api/analyze/stream", json=_stream_body())
    assert resp.status_code == 200
    events = _parse_events(resp.text)
    assert events == [{"type": "fallback", "reason": "no_key"}]


def test_stream_model_not_in_pool_returns_no_key(client, patch_analyzer_keys):
    # Key 池里只有 deepseek-chat，请求里用 kimi → no_key
    patch_analyzer_keys(_KEY_POOL)
    body = _stream_body()
    body["currentMessage"]["model"] = "kimi"
    resp = client.post("/api/analyze/stream", json=body)
    assert resp.status_code == 200
    events = _parse_events(resp.text)
    assert events == [{"type": "fallback", "reason": "no_key"}]


# ---------------------------------------------------------------------------
# 集成路径：respx 拦截真实 httpx 调用，端到端验证 SSE 链路
# ---------------------------------------------------------------------------


@respx.mock
def test_stream_happy_path_integration(client, patch_analyzer_keys):
    label_json = '{"label":"consensus","evidence":"观点一致"}'
    sse = _sse_data(label_json) + _sse_done()
    respx.post(_LLM_URL).mock(return_value=httpx.Response(200, content=sse))

    patch_analyzer_keys(_KEY_POOL)
    resp = client.post("/api/analyze/stream", json=_stream_body())
    assert resp.status_code == 200
    events = _parse_events(resp.text)
    deltas = [e for e in events if e["type"] == "delta"]
    finals = [e for e in events if e["type"] == "final"]
    assert len(deltas) == 1
    assert deltas[0]["content"] == label_json
    assert len(finals) == 1
    assert finals[0] == {"type": "final", "label": "consensus", "evidence": "观点一致"}


@respx.mock
def test_stream_parse_failed_integration(client, patch_analyzer_keys):
    # delta 累积为非 JSON 文本 → fallback parse_failed
    sse = _sse_data("普通文字没有JSON") + _sse_done()
    respx.post(_LLM_URL).mock(return_value=httpx.Response(200, content=sse))

    patch_analyzer_keys(_KEY_POOL)
    resp = client.post("/api/analyze/stream", json=_stream_body())
    events = _parse_events(resp.text)
    assert events[-1] == {"type": "fallback", "reason": "parse_failed"}


@respx.mock
def test_stream_http_500_integration(client, patch_analyzer_keys):
    respx.post(_LLM_URL).mock(return_value=httpx.Response(500, content=b"error"))

    patch_analyzer_keys(_KEY_POOL)
    resp = client.post("/api/analyze/stream", json=_stream_body())
    events = _parse_events(resp.text)
    assert events == [{"type": "fallback", "reason": "http_500"}]


@respx.mock
def test_stream_http_404_integration(client, patch_analyzer_keys):
    respx.post(_LLM_URL).mock(return_value=httpx.Response(404, content=b"not found"))

    patch_analyzer_keys(_KEY_POOL)
    resp = client.post("/api/analyze/stream", json=_stream_body())
    events = _parse_events(resp.text)
    assert events == [{"type": "fallback", "reason": "http_404"}]


# ---------------------------------------------------------------------------
# 响应类型
# ---------------------------------------------------------------------------


@respx.mock
def test_stream_media_type_is_event_stream(client, patch_analyzer_keys):
    sse = _sse_data('{"label":"neutral","evidence":"x"}') + _sse_done()
    respx.post(_LLM_URL).mock(return_value=httpx.Response(200, content=sse))

    patch_analyzer_keys(_KEY_POOL)
    resp = client.post("/api/analyze/stream", json=_stream_body())
    assert resp.headers["content-type"].startswith("text/event-stream")
