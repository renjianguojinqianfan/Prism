# 棱镜 (Prism)

> 多AI视角碰撞 · 共识/分歧一目了然

## ✨ 项目简介

「棱镜」是一个多 AI 讨论台。用户输入一个问题，可同时唤起 DeepSeek、Kimi、GLM、通义千问等多个 AI 模型进行圆桌讨论。名字取自“一束白光通过棱镜折射出七色光谱”——一个问题进入，多个 AI 从不同视角折射出各自的观点。

**当前状态**：前端 Demo 已完成，支持模拟讨论与真实 API 调用；FastAPI 后端已提供共识/分歧分析端点。

## 🎯 核心功能

- **一次提问，多方 AI 并行回答**：用户提出问题后，多个模型同时参与讨论
- **深色赛博朋克 UI**：沉浸式群聊界面，带发光动效
- **模拟 / 真实模式切换**：无需 API Key 即可体验，也可接入真实模型
- **模拟模式多轮连贯对话**：模拟模式下多轮讨论自动引用前文观点，保证对话连贯性
- **模型复选框选择器**：输入框上方复选框自由勾选参与讨论的模型，默认全选
- **讨论记录导出**：一键导出 Markdown 格式讨论记录
- **共识 / 分歧自动标注**：讨论结束后自动分析每条发言，并在气泡右上角标注「共识 💡 / 分歧 ⚡ / 中立 ·」
- **Markdown 渲染**：AI 回复支持 Markdown 语法渲染（加粗、列表、代码块、引用等）

## 🛠️ 技术栈

- **前端**：原生 HTML + CSS + JavaScript（单文件 `index.html`），引入 [marked.js](https://cdn.jsdelivr.net/npm/marked/marked.min.js)（CDN）用于 Markdown 渲染
- **后端**：FastAPI（`main.py`），提供 `GET /api/health` 健康检查与 `POST /api/analyze` 共识/分歧分析端点
- **部署**：Render / Vercel

## 📁 项目结构

```
.
├── index.html              # 前端主页面（所有 CSS/JS 内联）
├── main.py                 # FastAPI 后端入口（健康检查 + 共识/分歧分析）
├── requirements.txt        # Python 依赖（fastapi、uvicorn、pydantic）
├── .env.example            # 环境变量示例（占位，无真实 Key）
├── .env                    # 环境变量（用户本地创建，不提交 Git）
├── .gitignore              # Git 忽略规则
├── AGENTS.md               # AI 编程助手指令集
├── README.md               # 项目说明文档
└── .trae/specs/            # Spec 驱动开发的规格文档
    └── add-real-consensus-analysis/
        ├── spec.md
        ├── tasks.md
        └── checklist.md
```

## 🚀 快速开始

### 预览前端

1. 克隆本项目
2. 右键 `index.html` → 选择「Open with Live Server」
3. 在页面中输入话题，点击「发起」即可体验多 AI 模拟讨论

### 接入真实模型

1. 点击页面右上角「配置模型」
2. 填写各模型的 API Key
3. 关闭「模拟模式」开关
4. 发起讨论，即可调用真实模型 API

### 启动后端（共识/分歧真实分析）

后端提供 `/api/analyze` 接口，前端讨论结束后会自动调用；未启动时会自动回退到前端本地启发式分析（无感切换，并提示 toast）。

```bash
# 安装依赖（建议使用虚拟环境）
pip install -r requirements.txt

# 启动后端（默认端口 8000）
uvicorn main:app --reload --port 8000
```

- 健康检查：浏览器访问 [http://localhost:8000/api/health](http://localhost:8000/api/health) 应返回 `{"status":"ok"}`
- 前端默认指向 `http://localhost:8000/api/analyze`，如需修改请直接编辑 `index.html` 中的 `ANALYZE_ENDPOINT` 常量
- 环境变量参考 `.env.example`

<!-- AUTO-GENERATED: API 参考（来源：main.py 路由与 Pydantic 模型） -->
## 📡 API 参考

### `GET /api/health`

健康检查端点。

**响应**：`200 OK`

```json
{ "status": "ok" }
```

### `POST /api/analyze`

对一组 AI 发言进行共识/分歧启发式分析（基于关键词 Jaccard 相似度）。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `topic` | string | 否 | 讨论话题（默认空串） |
| `messages` | array | 否 | AI 发言列表（默认空数组） |
| `messages[].id` | string | 是 | 消息唯一 ID |
| `messages[].modelName` | string | 是 | 模型名称 |
| `messages[].content` | string | 是 | 发言内容 |

**请求示例**：

```json
{
  "topic": "远程办公",
  "messages": [
    { "id": "m1", "modelName": "DeepSeek", "content": "远程办公提升效率..." },
    { "id": "m2", "modelName": "Kimi", "content": "远程协作工具成熟..." }
  ]
}
```

**响应体**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `tags` | array | 每条消息对应一个标签 |
| `tags[].id` | string | 对应消息 ID |
| `tags[].label` | string | `"consensus"` / `"divergence"` / `"neutral"` |
| `tags[].score` | float | 与其他发言的平均 Jaccard 相似度（0-1） |
| `tags[].evidence` | string | 中文证据描述 |

**标签判定阈值**：`score >= 0.18` → consensus；`score <= 0.06` → divergence；其余 → neutral。

**响应示例**：

```json
{
  "tags": [
    { "id": "m1", "label": "consensus", "score": 0.234, "evidence": "与其他 1 条发言关键词重合度 0.234" },
    { "id": "m2", "label": "divergence", "score": 0.0, "evidence": "与其他发言显著分歧" }
  ]
}
```
<!-- /AUTO-GENERATED -->

<!-- AUTO-GENERATED: 环境变量（来源：.env.example 与 main.py） -->
## ⚙️ 环境变量

| 变量 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `PRISM_PORT` | 否 | 后端监听端口（默认 `8000`） | `8000` |
| `PRISM_CORS_ORIGINS` | 否 | 预留的 CORS 来源占位（代码当前使用 `*` 全放通，未读取此变量） | `http://localhost,http://127.0.0.1` |

> `.env.example` 仅含占位项，无真实 Key。用户本地创建 `.env` 文件（已被 `.gitignore` 忽略）。
<!-- /AUTO-GENERATED -->

<!-- AUTO-GENERATED: 命令参考（来源：requirements.txt 与 main.py） -->
## 💻 命令参考

| 命令 | 说明 |
|------|------|
| `pip install -r requirements.txt` | 安装 Python 依赖（fastapi、uvicorn、pydantic） |
| `uvicorn main:app --reload --port 8000` | 启动后端开发服务器（带热重载） |
| `python main.py` | 直接运行后端（读取 `PRISM_PORT`，默认 8000，带热重载） |
| 浏览器打开 `index.html` | 预览前端（推荐 Live Server） |
<!-- /AUTO-GENERATED -->

## 📝 参赛信息

- **赛事**：TRAE AI 创造力大赛
- **赛道**：学习工作赛道
- **作品名**：【学习工作赛道】棱镜——让AI观点碰撞成可视化光谱

## 📄 相关文档

- [AGENTS.md](./AGENTS.md) — AI 编程助手指令集

## 📜 许可证

MIT License