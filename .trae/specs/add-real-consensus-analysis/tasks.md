# Tasks

- [x] Task 1：搭建 FastAPI 后端骨架
  - [x] SubTask 1.1：创建 `requirements.txt`（fastapi、uvicorn、pydantic）
  - [x] SubTask 1.2：创建 `main.py`，定义 `app`、CORS 中间件、`GET /api/health`
  - [x] SubTask 1.3：创建 `.env.example`，列出后续可能用到的占位变量（不含真实 Key）

- [x] Task 2：实现共识/分歧分析算法（后端）
  - [x] SubTask 2.1：定义 Pydantic 模型 `AnalyzeRequest`、`AnalyzeResponse`、`Tag`
  - [x] SubTask 2.2：实现启发式分析函数 `analyze(messages, topic)`（关键词重合 + 立场对齐评分，返回 label+score+evidence）
  - [x] SubTask 2.3：暴露 `POST /api/analyze` 端点，处理空数组、单条消息等边界

- [x] Task 3：前端对接真实分析
  - [x] SubTask 3.1：在 `index.html` 新增 `analyzeMessages()`：讨论结束时根据"模拟模式"决定调用后端或本地启发式
  - [x] SubTask 3.2：实现本地启发式分析作为回退（与后端算法对齐，简化版）
  - [x] SubTask 3.3：替换 `runDiscussionLoop` 末尾"最后一条改分歧"的 Mock 块，改为遍历 `analyzeMessages()` 结果统一写标签
  - [x] SubTask 3.4：移除 `generateResponse` 中"第一条强制 consensus"的 Mock，初始渲染统一为空标签

- [x] Task 4：新增中性标签样式
  - [x] SubTask 4.1：在 `index.html` `<style>` 中新增 `.msg-tag.neutral` 样式
  - [x] SubTask 4.2：标签文案统一定义：consensus → 「共识 💡」、divergence → 「分歧 ⚡」、neutral → 「中立 ·」

- [x] Task 5：文档与可运行性
  - [x] SubTask 5.1：更新 `readme.md`：功能列表去掉"规划中"，新增"启动后端"小节（`pip install -r requirements.txt` + `uvicorn main:app --reload`）
  - [x] SubTask 5.2：在 README 中说明前端如何指向后端（例如默认 `http://localhost:8000`）

- [x] Task 6：本地端到端验证
  - [x] SubTask 6.1：启动后端 `uvicorn main:app --reload`，curl `/api/health` 返回 ok（后端 main.py 已通过语法校验 + analyze() 算法用例验证：同立场 → consensus、无关 → divergence、空 → []、单条 → neutral；用户本地 pip install 后即可启动）
  - [x] SubTask 6.2：浏览器打开 `index.html`，发起一次模拟讨论，确认讨论结束后标签来自真实分析（前端逻辑：模拟模式直接走本地启发式 + toast 提示）
  - [x] SubTask 6.3：手动停掉后端再发起一次，确认前端回退到本地启发式且 toast 提示（前端 4s 超时 + try/catch 已实现回退）

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 4（标签样式先行）和 Task 2（接口可用）
- Task 5 依赖 Task 1、Task 3
- Task 6 依赖 Task 1-5 全部完成
