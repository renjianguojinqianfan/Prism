import json
import os

# Jaccard 回退路径阈值（与 frontend/src/services/analyzer.ts 的 HIGH/LOW 必须保持一致）
JACCARD_HIGH = 0.14
JACCARD_LOW = 0.11

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "PRISM_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    ).split(",")
    if o.strip()
]


def load_analyzer_keys() -> dict[str, dict[str, str]]:
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
