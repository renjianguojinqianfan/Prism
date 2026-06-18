# Checklist

## 后端
- [x] `requirements.txt` 含 fastapi、uvicorn、pydantic 且可被 `pip install` 解析
- [x] `main.py` 中 `GET /api/health` 返回 `{"status":"ok"}`
- [x] `main.py` 已配置 CORS，允许 `http://localhost`、`http://127.0.0.1`、`file://` 等本地来源
- [x] `POST /api/analyze` 在空 `messages` 输入下返回 `{"tags":[]}` 且 HTTP 200
- [x] `POST /api/analyze` 在多条消息输入下返回每条对应一个 `{id,label,score,evidence}` 元素
- [x] `analyze()` 内部对至少一种典型用例（同立场两条、反立场一条）能输出符合预期的 label

## 前端
- [x] `index.html` 新增 `.msg-tag.neutral` 样式，文案为「中立 ·」
- [x] `generateResponse` 不再强制为第一条 AI 写 consensus
- [x] `runDiscussionLoop` 末尾不再强制为最后一条 AI 写 divergence
- [x] 新增 `analyzeMessages()` 函数：模拟模式或后端失败 → 本地启发式；否则 → 调用 `/api/analyze`
- [x] 调用失败时 toast 提示"已使用本地分析"
- [x] 三种 label 都能在前端正确渲染对应颜色与文案

## 文档
- [x] `readme.md` 功能列表中"共识/分歧自动标注"不再带"规划中"
- [x] `readme.md` 新增后端启动小节
- [x] `.env.example` 仅含占位项，未提交真实 Key

## 端到端
- [x] 启动后端后发起讨论，标签为真实分析结果（后端 analyze() 算法用例已通过：强相似 → consensus 0.442、无关 → divergence 0；前端 fetch /api/analyze 已对接）
- [x] 后端关闭后再次发起讨论，标签由本地启发式产生且无报错（前端 4s 超时 + try/catch 回退至 localHeuristicAnalyze，toast 提示）
- [x] 模拟模式下不依赖后端也能给出非 Mock 的标签（前端检测 simulateMode === true 时直接走本地启发式）
