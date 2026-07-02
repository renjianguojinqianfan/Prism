import json
from typing import Callable

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    """同步 TestClient，覆盖 /api/health 与 /api/analyze 等端点。

    流式端点 /api/analyze/stream 的测试可通过 dependency_overrides 注入 mock client：
        from app.api.deps import get_llm_client
        app.dependency_overrides[get_llm_client] = lambda: <mock async generator>
    测试结束记得 app.dependency_overrides.clear()。
    """
    return TestClient(app)


@pytest.fixture
def patch_analyzer_keys(monkeypatch: pytest.MonkeyPatch) -> Callable[..., None]:
    """设置 PRISM_ANALYZER_API_KEYS 环境变量；测试结束 monkeypatch 自动还原。

    用法：
        patch_analyzer_keys({"deepseek-chat": {"endpoint": "...", "key": "..."}})
    或不传参 → 清空环境变量（确保走 no_key 回退路径）。
    """

    def set_keys(pool: dict | None = None) -> None:
        if pool is None:
            monkeypatch.delenv("PRISM_ANALYZER_API_KEYS", raising=False)
            return
        monkeypatch.setenv("PRISM_ANALYZER_API_KEYS", json.dumps(pool))

    return set_keys
