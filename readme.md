# 棱镜 (Prism)

> 多AI视角碰撞 · 共识/分歧一目了然

## ✨ 项目简介

「棱镜」是一个多 AI 讨论台。用户输入一个问题，可同时唤起 DeepSeek、Kimi、GLM、通义千问等多个 AI 模型进行圆桌讨论。名字取自"一束白光通过棱镜折射出七色光谱"——一个问题进入，多个 AI 从不同视角折射出各自的观点。

**当前状态**：前端 React+TS 版本已完成，支持模拟讨论与真实 API 调用；FastAPI 后端已提供共识/分歧分析端点。根目录 `index.html` 为早期单文件原型（保留对照）。

## 🎯 核心功能

- **一次提问，多方 AI 串行回答**：用户提出问题后，多个模型依次参与讨论，后发言者能看到前文
- **深色赛博朋克 UI**：沉浸式群聊界面，带发光动效
- **模拟 / 真实模式切换**：无需 API Key 即可体验，也可接入真实模型
- **模拟模式多轮连贯对话**：模拟模式下多轮讨论自动引用前文观点，保证对话连贯性
- **模型复选框选择器**：输入框上方复选框自由勾选参与讨论的模型，默认全选
- **讨论控制**：暂停/继续、跳过当前发言者、一键重置
- **讨论记录导出**：一键导出 Markdown 格式讨论记录
- **共识 / 分歧自动标注**：讨论结束后自动分析每条发言，在气泡右上角标注「共识 💡 / 分歧 ⚡ / 中立 ·」（后端优先，不可用时回退本地启发式）
- **Markdown 渲染**：AI 回复支持 Markdown 语法（加粗、列表、代码块、引用等）
- **自定义模型**：支持添加任意兼容 OpenAI `/v1/chat/completions` 协议的模型端点

## 🛠️ 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS，状态用 Context+useReducer，Markdown 用 marked
- **后端**：FastAPI（`main.py`），提供 `GET /api/health` 健康检查与 `POST /api/analyze` 共识/分歧分析端点
- **模型调用**：浏览器端直连各家 OpenAI 兼容 API（流式 SSE），未配 Key 的模型自动跳过

## 📁 项目结构

```
.
├── frontend/                     # React + TypeScript 前端（当前主版本）
│   ├── index.html                # Vite 入口 HTML
│   ├── package.json              # npm 依赖与 scripts
│   ├── tsconfig.json             # TS 严格模式配置
│   ├── vite.config.ts            # Vite 配置
│   ├── tailwind.config.js        # Tailwind 配置
│   ├── postcss.config.js
│   ├── .env.example              # 前端环境变量（VITE_ANALYZE_ENDPOINT）
│   └── src/
│       ├── main.tsx              # React 挂载入口
│       ├── App.tsx               # 顶层布局
│       ├── App.css               # 深色主题 + 动效 + 气泡样式
│       ├── store/
│       │   ├── types.ts          # 全部 TS 类型定义
│       │   └── DiscussionContext.tsx  # Context+useReducer+讨论循环编排
│       ├── config/
│       │   └── presetModels.ts   # 4 个预设模型配置
│       ├── services/
│       │   ├── api.ts            # 历史构建 + 流式 chat SSE 解析
│       │   ├── simulator.ts      # 模拟模式回复生成
│       │   └── analyzer.ts       # 本地启发式分析 + 后端调用
│       ├── utils/
│       │   ├── escape.ts         # HTML 转义
│       │   ├── markdown.ts       # marked 封装
│       │   └── sleep.ts          # 延时 + ID 生成
│       └── components/
│           ├── Header.tsx        # 顶栏（标题/导出/设置）
│           ├── RoleBar.tsx       # 角色状态条（发言脉冲）
│           ├── ModelSelector.tsx # 模型复选框
│           ├── MessageList.tsx   # 消息列表 + 欢迎页
│           ├── MessageBubble.tsx # 消息气泡（标签+Markdown+打字光标）
│           ├── InputBar.tsx      # 输入框 + 控制条
│           ├── SettingsPanel.tsx # 模型配置面板（预设+自定义）
│           └── Toast.tsx         # 提示条
├── index.html                    # （原型）早期单 HTML 版本，保留对照
├── main.py                       # FastAPI 后端入口
├── requirements.txt              # Python 依赖（fastapi、uvicorn、pydantic）
├── .env.example                  # 后端环境变量示例
├── .gitignore
├── AGENTS.md                     # AI 编程助手指令集
├── README.md
└── .trae/specs/                  # Spec 驱动开发的规格文档
    └── add-real-consensus-analysis/
        ├── spec.md
        ├── tasks.md
        └── checklist.md
```

## 🚀 快速开始

### 前端开发

```bash
cd frontend
npm install
npm run dev         # 启动开发服务器，默认 http://localhost:5173
```

浏览器打开 [http://localhost:5173](http://localhost:5173) 即可体验。默认开启模拟模式，无需任何 API Key。

### 生产构建

```bash
cd frontend
npm run build       # tsc 类型检查 + vite 打包，输出到 frontend/dist/
npm run preview     # 预览构建产物
```

### 接入真实模型

1. 点击页面右上角「配置模型」
2. 填写各模型的 API Key（支持 DeepSeek / Kimi / GLM / 通义千问，或添加自定义 OpenAI 兼容端点）
3. 关闭「模拟模式」开关
4. 发起讨论，即可调用真实模型 API（流式输出）

### 启动后端（共识/分歧真实分析）

后端提供 `/api/analyze` 接口，前端讨论结束后会自动调用；未启动时会自动回退到前端本地启发式分析（无感切换，并提示 toast）。

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- 健康检查：浏览器访问 [http://localhost:8000/api/health](http://localhost:8000/api/health) 应返回 `{"status":"ok"}`
- 前端默认通过环境变量 `VITE_ANALYZE_ENDPOINT` 指向 `http://localhost:8000/api/analyze`，复制 `frontend/.env.example` 为 `frontend/.env` 可修改
- 后端环境变量参考根目录 `.env.example`

<!-- AUTO-GENERATED: 命令参考（来源：frontend/package.json scripts + requirements.txt） -->
## 💻 命令参考

### 前端（frontend/）

| 命令 | 说明 |
|------|------|
| `npm install` | 安装前端依赖 |
| `npm run dev` | 启动 Vite 开发服务器（HMR，默认 5173 端口） |
| `npm run build` | 先做 TS 类型检查再打包生产版本到 `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run typecheck` | 仅运行 TypeScript 类型检查（不打包） |

### 后端（项目根目录）

| 命令 | 说明 |
|------|------|
| `pip install -r requirements.txt` | 安装 Python 依赖（fastapi、uvicorn、pydantic） |
| `uvicorn main:app --reload --port 8000` | 启动后端开发服务器（带热重载） |
<!-- /AUTO-GENERATED -->

<!-- AUTO-GENERATED: 环境变量（来源：frontend/.env.example 与根目录 .env.example） -->
## ⚙️ 环境变量

### 前端（`frontend/.env`，由 `frontend/.env.example` 复制）

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `VITE_ANALYZE_ENDPOINT` | 否 | 后端共识/分歧分析端点 URL | `http://localhost:8000/api/analyze` |

### 后端（项目根目录 `.env`）

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `PRISM_PORT` | 否 | 后端监听端口 | `8000` |
| `PRISM_CORS_ORIGINS` | 否 | 允许的 CORS 来源列表（逗号分隔） | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173` |

> `.env` 文件已被 `.gitignore` 忽略，不会提交到仓库。
<!-- /AUTO-GENERATED -->

<!-- AUTO-GENERATED: API 参考（来源：main.py 路由与 Pydantic 模型） -->
## 📡 API 参考

### `GET /api/health`

健康检查端点。

**响应**：`200 OK`

```json
{ "status": "ok" }
```

### `POST /api/analyze`

对一组 AI 发言进行共识/分歧启发式分析（基于关键词 Jaccard 2-gram 相似度）。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `topic` | string | 否 | 讨论话题（默认空串） |
| `messages` | array | 否 | AI 发言列表（默认空数组） |
| `messages[].id` | string | 是 | 消息唯一 ID |
| `messages[].modelName` | string | 是 | 模型名称 |
| `messages[].content` | string | 是 | 发言内容 |

**响应体**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `tags` | array | 每条消息对应一个标签 |
| `tags[].id` | string | 对应消息 ID |
| `tags[].label` | string | `"consensus"` / `"divergence"` / `"neutral"` |
| `tags[].score` | float | 与其他发言的平均 Jaccard 相似度（0-1） |
| `tags[].evidence` | string | 中文证据描述 |

**标签判定阈值**：`score >= 0.14` → consensus；`score <= 0.11` → divergence；其余 → neutral。

**响应示例**：

```json
{
  "tags": [
    { "id": "m1", "label": "consensus", "score": 0.155, "evidence": "与其他 3 条发言关键词重合度 0.155" },
    { "id": "m2", "label": "divergence", "score": 0.0, "evidence": "与其他发言显著分歧" }
  ]
}
```
<!-- /AUTO-GENERATED -->

## 📝 参赛信息

- **赛事**：TRAE AI 创造力大赛
- **赛道**：学习工作赛道
- **作品名**：【学习工作赛道】棱镜——让AI观点碰撞成可视化光谱

## 📄 相关文档

- [AGENTS.md](./AGENTS.md) — AI 编程助手指令集

## 📜 许可证

MIT License
