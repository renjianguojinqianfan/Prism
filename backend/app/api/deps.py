from typing import AsyncGenerator

import httpx


async def get_llm_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """提供流式自评分析用的 httpx 客户端。
    测试可通过 app.dependency_overrides[get_llm_client] 注入 mock，避免真实网络调用。
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        yield client
