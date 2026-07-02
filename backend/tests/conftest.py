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
