# 真实共识/分歧分析 与 FastAPI 后端骨架 Spec

> change-id: `add-real-consensus-analysis`

## Why

当前棱镜（Prism）前端已完成多模型讨论 Demo，但「共识/分歧」标签仍是 Mock 逻辑（第一条打共识、最后一条打分歧），无法体现产品核心价值"多视角折射"。同时项目仍缺少 FastAPI 后端骨架（README 与 AGENTS.md 中均标注为"待建"）。本次 Spec 聚焦于：用一次极简的后端能力，让"共识/分歧"标签变成基于内容真实分析的结果，并为后续模型代理调用打好结构基础。

## What Changes

- 新增 FastAPI 后端骨架：`main.py` + `requirements.txt`，提供单一分析端点 `POST /api/analyze`
- 新增"共识/分歧分析"算法：在后端基于关键词/语义对齐对每条 AI 发言打标签（`consensus` / `divergence` / `neutral`）
- 前端 `index.html` 改造：讨论结束后调用 `/api/analyze`，用真实结果替换 Mock 标签；模拟模式下保留前端纯本地分析（不依赖后端）
- 新增 `.env.example`，记录后端运行需要的环境变量（仅占位，无真实 Key）
- README 同步：把"共识/分歧自动标注（规划中）"改为"已支持"，补充后端启动指引
- **BREAKING**：原前端 Mock 标签策略（第一条共识/最后一条分歧）将被替换为真实分析结果

## Impact

- 受影响 specs：项目暂无其他 specs，本 Spec 为首个
- 受影响代码：
  - `index.html`（仅修改 `runDiscussionLoop` 结束段、`generateResponse` 标签插入段、新增 `analyzeMessages()` 与一段 CSS 中性标签样式）
  - 新增 `main.py`、`requirements.txt`、`.env.example`
  - `readme.md`（功能列表与启动说明）

## ADDED Requirements

### Requirement: 后端分析端点
系统 SHALL 提供 `POST /api/analyze`，接收讨论消息列表，返回每条消息的共识/分歧标签。

#### Scenario: 正常分析
- **WHEN** 前端 POST `{ topic, messages: [{id, modelName, content}, ...] }`
- **THEN** 返回 `{ tags: [{id, label, score, evidence}] }`，其中 `label ∈ {"consensus","divergence","neutral"}`

#### Scenario: 空消息列表
- **WHEN** 请求中 `messages` 为空数组
- **THEN** 返回 HTTP 200，`tags: []`

### Requirement: 真实标签替换 Mock
系统 SHALL 在讨论结束后用后端分析结果替换前端预先打的 Mock 标签。

#### Scenario: 在线分析成功
- **WHEN** 讨论结束且后端 `/api/analyze` 返回 200
- **THEN** 每条 AI 气泡右上角根据 `label` 渲染对应颜色的标签（共识绿/分歧橙/中性灰）

#### Scenario: 后端不可达或失败
- **WHEN** 后端请求失败 / 超时 / 模拟模式开启
- **THEN** 前端回退到本地 Mock 规则，不阻塞用户体验，并通过 toast 提示"已使用本地分析"

### Requirement: 后端骨架可独立启动
系统 SHALL 提供可通过 `uvicorn main:app --reload` 启动的最小 FastAPI 应用，包含 CORS 配置以允许本地前端调用。

#### Scenario: 健康检查
- **WHEN** GET `/api/health`
- **THEN** 返回 `{ "status": "ok" }`

### Requirement: 中性标签视觉样式
系统 SHALL 为新增的 `neutral` 标签提供与现有共识/分歧一致的视觉风格（圆角胶囊、深色背景、灰色描边）。

#### Scenario: 中性渲染
- **WHEN** 一条消息分析结果为 `neutral`
- **THEN** 该气泡右上角显示灰色「中立 ·」标签，hover 不变色

## MODIFIED Requirements

### Requirement: 共识/分歧标签来源
原标签来源为前端 Mock（第一条/最后一条），现修改为：
- 真实模式：后端 `/api/analyze` 返回结果
- 模拟模式 / 后端失败：前端本地启发式（关键词重合度 ≥ 阈值 → consensus；与多数立场相反 → divergence；其余 neutral）

## REMOVED Requirements

### Requirement: 固定 Mock 标签策略（第一条共识/最后一条分歧）
**Reason**：与产品核心价值"真实多视角碰撞"不符，仅作为初版占位
**Migration**：保留同名 CSS 样式（`.msg-tag.consensus / .divergence`），新增 `.neutral`；逻辑层由 `analyzeMessages()` 统一接管标签写入
