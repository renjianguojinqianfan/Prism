# AGENTS.md - 棱镜 (Prism)

> 本文件为 AI 编程助手的核心指令集，优先级高于所有口头约定。

## 1. 项目快照

- **项目名称**：棱镜 (Prism)
- **一句话描述**：多 AI 讨论台。用户提问后，DeepSeek、Kimi、GLM 三个模型同时参与讨论，自动标注观点的"共识"与"分歧"。
- **项目类型**：`web`
- **技术栈**：
  - 前端：原生 HTML + CSS + JavaScript（单文件 `index.html`）
  - 后端：FastAPI（`main.py`，待建）
  - 部署：Render / Vercel
  - 模型调用：火山引擎 Coding Plan Pro

## 2. 关键规则

### 必须遵守
- **改代码前先说明计划**：不得直接改代码，必须先向用户确认
- **一个对话 = 一个任务**：不混杂多个不相关的改动
- **前端锁定单文件架构**：所有 CSS 和 JS 保持内联在 `index.html` 中，禁止拆分
- **禁止硬编码密钥**：API Key 通过 `.env` 文件或用户输入传入

### 禁止事项
- 禁止引入 React/Vue 等框架
- 禁止擅自更改深色赛博朋克 UI 风格
- 禁止在 `index.html` 中硬编码 API Key
- 禁止提交未经用户确认的代码

## 3. 文件清单

| 文件 | 用途 |
|------|------|
| `index.html` | 前端主页面（所有 CSS/JS 内联） |
| `main.py` | FastAPI 后端入口（待建） |
| `requirements.txt` | Python 依赖（待建） |
| `.env` | 环境变量（API Key 等），存放于项目根目录，禁止提交 |

## 4. Git 提交规范

- commit message 格式：`<type>: <描述>`
- type 可选：`feat` / `fix` / `style` / `refactor`
- 描述用中文，一句话说清改动
- 示例：`feat: 添加模型选择器UI`