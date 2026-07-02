import json

from app.config import load_analyzer_keys


def test_load_keys_unset(monkeypatch):
    monkeypatch.delenv("PRISM_ANALYZER_API_KEYS", raising=False)
    assert load_analyzer_keys() == {}


def test_load_keys_empty_string(monkeypatch):
    monkeypatch.setenv("PRISM_ANALYZER_API_KEYS", "")
    assert load_analyzer_keys() == {}


def test_load_keys_valid_json(monkeypatch):
    pool = {
        "deepseek-chat": {
            "endpoint": "https://api.deepseek.com/v1/chat/completions",
            "key": "sk-xxx",
        }
    }
    monkeypatch.setenv("PRISM_ANALYZER_API_KEYS", json.dumps(pool))
    result = load_analyzer_keys()
    assert result == {
        "deepseek-chat": {
            "endpoint": "https://api.deepseek.com/v1/chat/completions",
            "key": "sk-xxx",
        }
    }


def test_load_keys_non_dict_json(monkeypatch):
    # JSON 合法但顶层非 dict（如 list）→ {}
    monkeypatch.setenv("PRISM_ANALYZER_API_KEYS", "[1, 2, 3]")
    assert load_analyzer_keys() == {}


def test_load_keys_entry_missing_fields_skipped(monkeypatch):
    # 缺 endpoint 或 key 的条目被跳过，其余保留
    pool = {
        "good": {"endpoint": "https://x", "key": "k"},
        "no-endpoint": {"key": "k"},
        "no-key": {"endpoint": "https://x"},
        "not-dict": "scalar",
    }
    monkeypatch.setenv("PRISM_ANALYZER_API_KEYS", json.dumps(pool))
    assert load_analyzer_keys() == {
        "good": {"endpoint": "https://x", "key": "k"},
    }


def test_load_keys_invalid_json(monkeypatch):
    monkeypatch.setenv("PRISM_ANALYZER_API_KEYS", "{not valid json")
    assert load_analyzer_keys() == {}


def test_load_keys_extra_fields_ignored(monkeypatch):
    # 只保留 endpoint/key，额外字段被丢弃
    pool = {
        "m": {"endpoint": "https://x", "key": "k", "extra": "ignored", "model": "drop"}
    }
    monkeypatch.setenv("PRISM_ANALYZER_API_KEYS", json.dumps(pool))
    assert load_analyzer_keys() == {"m": {"endpoint": "https://x", "key": "k"}}


def test_load_keys_multiple_entries(monkeypatch):
    pool = {
        "deepseek-chat": {"endpoint": "https://a", "key": "ka"},
        "kimi": {"endpoint": "https://b", "key": "kb"},
    }
    monkeypatch.setenv("PRISM_ANALYZER_API_KEYS", json.dumps(pool))
    result = load_analyzer_keys()
    assert set(result.keys()) == {"deepseek-chat", "kimi"}
