# 重构 main.py 为分层架构 + pytest 脚手架

## 摘要

将根目录 377 行单文件 `main.py` 拆分为 `backend/` 目录下的分层包结构（app/main + config + schemas + services + api），并通过依赖注入让 httpx 客户端可被测试替换，同时搭建 pytest 脚手架（conftest + 2 个示例测试）验证可测试性。行为零变更，同步更新 AGENTS.md / readme.md / .gitignore 等所有受影响上下文。

## 当前状态分析

`main.py`（377 行）单文件混合了 6 类职责：

| 行号 | 内容 | 问题 |
|------|------|------|
| 18-31 | app 创建 + CORS | app 创建与运行入口耦合 |
| 34-72 | 6 个 Pydantic 模型 | 与路由混在一起 |
| 74-207 | Jaccard 启发式（`_STOPWORDS`/`_tokenize`/`_jaccard`/`analyze`） | 纯函数，但不可单独 import |
| 210-282 | 流式自评（prompt 模板/`_load_analyzer_keys`/`_parse_label_json`/`_build_analyzer_prompt`） | 配置加载与业务逻辑混在一起 |
| 287-368 | 3 个路由 | `stream_llm` 闭包内联 `httpx.AsyncClient`，**无法 mock，测试最大障碍** |
| 371-377 | `__main__` | import 即可能触发副作用 |

测试可行性障碍：① 无 pytest 配置；② httpx 调用内联在路由闭包，无法注入 mock；③ app 创建与运行未分离。

## 目标架构

```
backend/
├── main.py                    # 仅入口：uvicorn.run("app.main:app", ...)
├── requirements.txt           # 运行时依赖（从根目录迁入）
├── requirements-dev.txt       # 开发依赖：pytest, pytest-asyncio
├── pytest.ini                 # pytest 配置
├── .env.example               # 后端环境变量示例（从根目录迁入，更新路径注释）
├── app/
│   ├── __init__.py            # 空包标记
│   ├── main.py                # 模块级 app = FastAPI(...) + CORS + include_router
│   ├── config.py              # CORS_ORIGINS / PORT / JACCARD_HIGH=0.14 / JACCARD_LOW=0.11 / load_analyzer_keys()
│   ├── schemas.py             # 6 个 Pydantic 模型
│   ├── services/
│   │   ├── __init__.py        # 空包标记
│   │   ├── heuristic.py       # _STOPWORDS / _is_cjk / _tokenize / _jaccard / analyze()
│   │   └── analyzer.py        # prompt 模板 / build_analyzer_prompt() / parse_label_json() / stream_self_eval()
│   └── api/
│       ├── __init__.py        # 空包标记
│       ├── deps.py            # get_llm_client() —— 可注入的 httpx 客户端
│       ├── health.py          # router: GET /api/health
│       └── analyze.py         # router: POST /api/analyze + POST /api/analyze/stream
└── tests/
    ├── __init__.py            # 空包标记
    ├── conftest.py            # client fixture（TestClient）
    ├── test_heuristic.py      # 示例：analyze() 空列表/单条/双条
    └── test_api.py            # 示例：/api/health + /api/analyze
```

## 关键设计决策

### 1. 依赖注入 httpx 客户端（核心可测试性改造）

将 `stream_llm` 闭包内的 `httpx.AsyncClient` 提取为 FastAPI 依赖：

```python
# app/api/deps.py
async def get_llm_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        yield client

# app/services/analyzer.py
async def stream_self_eval(
    client: httpx.AsyncClient, endpoint: str, api_key: str, payload: dict
) -> AsyncGenerator[str, None]:
    # 原 stream_llm 闭包体的全部解析逻辑搬入此处，client 由参数传入
    ...

# app/api/analyze.py
@router.post("/api/analyze/stream")
async def analyze_stream(
    req: StreamAnalyzeRequest,
    client: httpx.AsyncClient = Depends(get_llm_client),
) -> StreamingResponse:
    ...
    return StreamingResponse(
        stream_self_eval(client, cfg["endpoint"], cfg["key"], payload),
        media_type="text/event-stream",
    )
```

测试通过 `app.dependency_overrides[get_llm_client] = ...` 注入返回固定 SSE chunk 的 mock，无需真实网络。

### 2. app 创建与运行分离

- `app/main.py`：模块级 `app = FastAPI(...)`，加 CORS、`include_router`。import 无副作用（不调 `uvicorn.run`）。
- `backend/main.py`：仅 `if __name__ == "__main__": uvicorn.run("app.main:app", ...)`。
- 测试 `from app.main import app` 后用 `TestClient(app)` 直接测。

### 3. 纯函数集中到 services

`heuristic.py`（Jaccard 分析）与 `analyzer.py` 中 `build_analyzer_prompt`/`parse_label_json` 均为纯函数，迁入后可独立 import 测试。`load_analyzer_keys()` 读环境变量，放入 `config.py`，测试用 `monkeypatch.setenv` 覆盖。

### 4. 阈值集中

`JACCARD_HIGH=0.14` / `JACCARD_LOW=0.11` 作为 `config.py` 模块常量，`heuristic.py::analyze()` 引用之。前端 `analyzer.ts` 的 `HIGH/LOW` 保持不变（AGENTS.md 阈值同步约束仍为手动维护，本计划不改阈值数值）。

## 详细变更清单

### A. 新建 backend/ 包文件

| 文件 | 来源（main.py 行号） | 说明 |
|------|----------------------|------|
| `backend/main.py` | 371-377 | 入口，`uvicorn.run("app.main:app", host, port, reload)` |
| `backend/app/__init__.py` | — | 空 |
| `backend/app/main.py` | 18-31 | `app=FastAPI(title="Prism Backend",version="0.1.0")` + CORS（从 config 读 origins）+ include health/analyze router |
| `backend/app/config.py` | 20-23, 181-182, 231-255 | `ALLOWED_ORIGINS` 解析、`PRISM_PORT`、`JACCARD_HIGH/LOW`、`load_analyzer_keys()` |
| `backend/app/schemas.py` | 36-72 | Message / AnalyzeRequest / Tag / AnalyzeResponse / AnalyzerMessage / StreamAnalyzeRequest（含字段注释） |
| `backend/app/services/__init__.py` | — | 空 |
| `backend/app/services/heuristic.py` | 77-207 | `_STOPWORDS` / `_is_cjk` / `_tokenize` / `_jaccard` / `analyze()`（thresholds 改用 config 常量） |
| `backend/app/services/analyzer.py` | 213-282, 331-366 | prompt 模板 / `build_analyzer_prompt()` / `parse_label_json()` / `stream_self_eval(client, endpoint, api_key, payload)` |
| `backend/app/api/__init__.py` | — | 空 |
| `backend/app/api/deps.py` | 333（内联） | `get_llm_client()` 异步生成器依赖 |
| `backend/app/api/health.py` | 287-289 | `router = APIRouter()` + `GET /api/health` |
| `backend/app/api/analyze.py` | 292-368 | `router` + `POST /api/analyze`（调 `heuristic.analyze`）+ `POST /api/analyze/stream`（用 `Depends(get_llm_client)` + `stream_self_eval`） |
| `backend/requirements.txt` | 根 requirements.txt | 原样迁入（fastapi/uvicorn/pydantic/httpx） |
| `backend/requirements-dev.txt` | — | `pytest>=8.0` / `pytest-asyncio>=0.23` / `httpx>=0.27`（测试用） |
| `backend/pytest.ini` | — | `[pytest] testpaths=tests asyncio_mode=auto` |
| `backend/.env.example` | 根 .env.example | 迁入，注释改 `# 启动后端：cd backend && uvicorn main:app --reload --port 8000` |
| `backend/tests/__init__.py` | — | 空 |
| `backend/tests/conftest.py` | — | `@pytest.fixture def client(): return TestClient(app)`（from app.main import app） |
| `backend/tests/test_heuristic.py` | — | 3 个用例：空列表→[] / 单条→neutral / 双条已知内容→预期 label |
| `backend/tests/test_api.py` | — | 2 个用例：`GET /api/health`→`{"status":"ok"}` / `POST /api/analyze` 空体→`{"tags":[]}` |

### B. 删除根目录旧文件

- 删除 `e:\code\Prism\main.py`（内容已全部分迁）
- 删除 `e:\code\Prism\requirements.txt`（已迁入 backend/）
- 删除 `e:\code\Prism\.env.example`（已迁入 backend/）

### C. 更新受影响上下文

| 文件 | 改动 |
|------|------|
| `AGENTS.md` | ① 第 1 节技术栈：`FastAPI（main.py）` → `FastAPI（backend/ 分层包）`；② 第 1 节目录约定：`根目录 main.py` 行改为 `backend/ — FastAPI 后端（分层：app/main + app/services + app/api）`；③ 第 3 节后端文件清单：替换 main.py/requirements.txt/.env.example 三行为 backend/ 目录树（含 tests/）；④ 第 4 节启动后端命令改 `cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`，新增测试运行 `cd backend && pip install -r requirements-dev.txt && pytest` |
| `readme.md` | ① 第 67 行 `在根目录 .env 中设置` → `在 backend/.env 中设置（参考 backend/.env.example）`；② 第 78-80 行启动命令加 `cd backend &&` 前缀 |
| `.gitignore` | 新增 `.pytest_cache/`（Python 段） |

## 行为不变性保证（验证清单）

重构必须逐项保留以下行为，示例测试覆盖关键项：

1. `GET /api/health` → `{"status":"ok"}`（test_api.py 覆盖）
2. `POST /api/analyze` 空体 → `{"tags":[]}`（test_api.py 覆盖）
3. `analyze([], topic)` → `[]`；`analyze([单条], topic)` → `[neutral, score=0.0]`（test_heuristic.py 覆盖）
4. `POST /api/analyze/stream` 无 Key → SSE `data: {"type":"fallback","reason":"no_key"}`（保留，靠 config 空池）
5. SSE 事件格式不变：`delta` / `final` / `fallback` 三类，字段名与 ensure_ascii=False 不变
6. prompt 模板 `{topic}/{prior_messages}/{your_message}` 占位与 `{{}}` 转义完全保留
7. 阈值 HIGH=0.14 / LOW=0.11 数值不变
8. CORS 默认来源列表不变
9. 前端 `VITE_ANALYZE_ENDPOINT` 指向的 URL（localhost:8000/api/analyze/stream）不变，前端零改动

## 假设与决策

- **不引入 `create_app()` 工厂**：模块级 `app` 已足够测试用（TestClient + dependency_overrides），更简单。决策依据：用户规则「Simplicity First」。
- **不引入 pydantic-settings BaseSettings**：当前仅 3 个环境变量，`os.getenv` 已足够，避免新增依赖。如未来配置增多再升级。
- **示例测试不覆盖 stream 路由的 mock**：仅做脚手架验证（health + analyze + heuristic）。stream 的 mock 依赖注入机制已就位，后续补测试时直接用 `app.dependency_overrides[get_llm_client]`。在 conftest.py 留注释说明用法。
- **不动前端**：前端 URL 指向 localhost:8000 不变，零改动。
- **阈值同步约束**：AGENTS.md 已记录前后端阈值须手动同步，本计划不改数值，仅在 backend 侧集中到 config.py。

## 验证步骤

1. `cd backend && pip install -r requirements.txt -r requirements-dev.txt`
2. `cd backend && pytest -v` → 5 个用例全过
3. `cd backend && uvicorn main:app --reload --port 8000` → 启动无报错
4. 浏览器访问 `http://localhost:8000/api/health` → `{"status":"ok"}`
5. 前端 `npm run dev` 后发起讨论，模拟模式 + 真实模式均正常（模拟模式不调后端，真实模式走 stream 回退路径正常）
6. `cd frontend && npm run typecheck` → 通过（确认前端未受影响）

## 实施顺序

1. 创建 backend/ 目录骨架（空 __init__.py + pytest.ini + requirements）
2. 迁移 schemas.py / config.py / services（heuristic + analyzer）/ api（deps + health + analyze）/ app/main.py
3. 创建 backend/main.py 入口
4. 写 tests/（conftest + test_heuristic + test_api）
5. 删除根 main.py / requirements.txt / .env.example
6. 更新 AGENTS.md / readme.md / .gitignore
7. 运行验证步骤 1-4（后端自验）
8. 交付用户做前端联调验证（步骤 5-6）
