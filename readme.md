# 棱镜 (Prism)

> 多AI视角碰撞 · 共识/分歧一目了然

## ✨ 项目简介

「棱镜」是一个多 AI 讨论台。用户输入一个问题，可同时唤起用户自填的多个 AI 模型进行圆桌讨论（提供 DeepSeek/Kimi/GLM/通义/Mimo 五个快速添加模板，建议使用不同厂商的模型以让观点碰撞更充分）。名字取自"一束白光通过棱镜折射出七色光谱"——一个问题进入，多个 AI 从不同视角折射出各自的观点。

**当前状态**：前端 React+TS 版本已完成，支持模拟讨论与真实 API 调用；FastAPI 后端已提供共识/分歧分析端点。根目录 `index.html` 为早期单文件原型（保留对照）。

## 🎯 核心功能

- **一次提问，多方 AI 串行回答**：用户提出问题后，多个模型依次参与讨论，后发言者能看到前文
- **深色赛博朋克 UI**：沉浸式群聊界面，带发光动效
- **模拟 / 真实模式切换**：无需 API Key 即可体验，也可接入真实模型
- **模拟模式多轮连贯对话**：模拟模式下多轮讨论自动引用前文观点，保证对话连贯性
- **模型复选框选择器**：输入框上方复选框自由勾选参与讨论的模型，默认全选
- **讨论控制**：暂停/继续、跳过当前发言者、一键重置
- **讨论记录导出**：一键导出 Markdown 格式讨论记录
- **共识 / 分歧实时自评**：每条 AI 发言结束后，由发言者自己的 LLM 对自己发言做评估并实时流式推送回前端，气泡右上角标注「共识 💡 / 分歧 ⚡ / 中立 ·」并附加「· {analyzer}自评」子文案。第一条发言作为基准不带标签，从第二条开始评估。三级回退：自评失败 → 后端 Jaccard 同步分析 → 前端本地启发式
- **Markdown 渲染 + XSS 防护**：AI 回复支持 Markdown 语法（加粗、列表、代码块、引用等），通过 marked `walkTokens` 转义 HTML token 防止 XSS 攻击
- **自定义模型**：支持添加任意兼容 OpenAI `/v1/chat/completions` 协议的模型端点

## 🛠️ 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS，状态用 Context+useReducer，Markdown 用 marked
- **后端**：FastAPI（`main.py`）+ httpx，提供 `GET /api/health` 健康检查、`POST /api/analyze`（Jaccard 同步回退）与 `POST /api/analyze/stream`（发言者自评 SSE 流式）三个端点
- **模型调用**：浏览器端直连各家 OpenAI 兼容 API（流式 SSE），未配 Key 的模型自动跳过
- **分析 Key 管理**：发言者自评用 endpoint 与 API Key 通过后端环境变量 `PRISM_ANALYZER_API_KEYS`（JSON 字符串，按 model 名匹配，结构 `{"model":{"endpoint":url,"key":apiKey}}`）统一管理，前端只传 model 名，不传 endpoint 也不传 Key（避免 SSRF 与 Key 泄漏）

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
│       │   └── presetModels.ts   # 5 个快速添加模板 + localStorage key
│       ├── services/
│       │   ├── api.ts            # 历史构建 + 流式 chat SSE 解析
│       │   ├── simulator.ts      # 模拟模式回复生成
│       │   └── analyzer.ts       # 本地启发式 + 同步回退 + SSE 流式自评解析
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
│           ├── SettingsPanel.tsx # 模型配置面板（快速模板+自定义）
│           └── Toast.tsx         # 提示条
├── index.html                    # （原型）早期单 HTML 版本，保留对照
├── main.py                       # FastAPI 后端入口（health + Jaccard 同步 + 自评 SSE 流式）
├── requirements.txt              # Python 依赖（fastapi、uvicorn、pydantic、httpx）
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

## 🎬 快速演示

面向客户快速展示，两种方式任选其一：

1. **单文件原型**：直接双击根目录 `index.html` 即可在浏览器打开，模拟模式即开即用，无需安装任何依赖。为避免 `file://` 协议限制，推荐用本地静态服务器打开：

   ```bash
   python -m http.server 8080
   # 浏览器访问 http://localhost:8080/index.html
   ```

2. **React 完整版**：进入 `frontend/` 执行 `npm install && npm run dev`，功能完整（含设置面板、自定义模型、导出等），访问 [http://localhost:5173](http://localhost:5173)。

两种方式默认均开启**模拟模式**，无需 API Key 即可看到多 AI 圆桌讨论效果。

> 注意事项：
> - `index.html` 依赖联网 CDN（Tailwind / Google Fonts / Font Awesome / marked），首次打开需联网
> - 需现代浏览器（推荐 Chrome 或 Edge 最新版）
> - 切换到**真实 LLM 模式**：在设置面板填写各模型 API Key 并保持联网，关闭「模拟模式」开关即可

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

1. 点击页面右上角「配置模型」（首次进入会自动展开配置面板）
2. 点击「快速添加模板」一键填入端点/模型名/角色设定（DeepSeek / Kimi / GLM / 通义 / Mimo），或点击「添加自定义模型」手填任意 OpenAI 兼容端点
3. 为每个模型填写 API Key（发言用）
4. 关闭「模拟模式」开关
5. 发起讨论，即可调用真实模型 API（流式输出）

### 启动后端（共识/分歧实时自评）

后端提供 `POST /api/analyze/stream`（发言者自评 SSE 流式，主路径）与 `POST /api/analyze`（Jaccard 同步，回退路径）两个端点。每条 AI 发言结束后前端会立即调用 `/api/analyze/stream`；若后端未启动 / 自评失败 / 无对应 Key，会自动按「后端 Jaccard → 前端本地启发式」三级回退（无感切换，并提示 toast）。

**配置发言者自评用 endpoint + API Key**：在根目录 `.env` 中设置 `PRISM_ANALYZER_API_KEYS` 为 JSON 字符串，按 model 名同时配置 endpoint 与 Key（结构与 `.env.example` 一致）：

```
PRISM_ANALYZER_API_KEYS={"deepseek-chat":{"endpoint":"https://api.deepseek.com/v1/chat/completions","key":"sk-xxx"},"mimo-v2.5":{"endpoint":"https://api.mimo.com/v1/chat/completions","key":"sk-yyy"}}
```

> endpoint 与 Key 都由后端统一管理，前端只传 model 名，杜绝 SSRF 与 Key 泄漏（C1 修复）。此配置池仅用于「发言者自评」环节，与前端用户填写的发言用 Key 是分开的两套；不配则自动走 Jaccard 回退路径。

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- 健康检查：浏览器访问 [http://localhost:8000/api/health](http://localhost:8000/api/health) 应返回 `{"status":"ok"}`
- 前端默认通过环境变量 `VITE_ANALYZE_ENDPOINT` 指向 `http://localhost:8000/api/analyze/stream`（主路径），`VITE_ANALYZE_FALLBACK_ENDPOINT` 指向 `http://localhost:8000/api/analyze`（Jaccard 回退）；复制 `frontend/.env.example` 为 `frontend/.env` 可修改
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
| `VITE_ANALYZE_ENDPOINT` | 否 | 后端发言者自评流式端点 URL（主路径） | `http://localhost:8000/api/analyze/stream` |
| `VITE_ANALYZE_FALLBACK_ENDPOINT` | 否 | 后端 Jaccard 同步回退端点 URL | `http://localhost:8000/api/analyze` |

### 后端（项目根目录 `.env`）

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `PRISM_PORT` | 否 | 后端监听端口 | `8000` |
| `PRISM_CORS_ORIGINS` | 否 | 允许的 CORS 来源列表（逗号分隔） | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173` |
| `PRISM_ANALYZER_API_KEYS` | 否 | 发言者自评用配置池（JSON 字符串，按 model 名匹配，结构 `{"model":{"endpoint":url,"key":apiKey}}`）。例：`{"deepseek-chat":{"endpoint":"https://api.deepseek.com/v1/chat/completions","key":"sk-xxx"}}`。endpoint 与 Key 都由后端统一管理，前端只传 model 名（C1 修复，避免 SSRF 与 Key 泄漏）。不配则自动走 Jaccard 回退 | 空（不启用自评） |

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

### `POST /api/analyze/stream`

**主路径**：对一条 AI 发言做共识/分歧实时自评（SSE 流式推送）。后端从 `PRISM_ANALYZER_API_KEYS` 按该发言者 model 名同时取 endpoint + Key，调用其自己的 LLM 评估自己发言与前文的共识/分歧关系。endpoint 与 Key 都由后端统一管理，前端只传 model 名（C1 修复，避免 SSRF 与 Key 泄漏）。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `topic` | string | 否 | 讨论话题 |
| `currentMessage` | object | 是 | 当前刚结束的发言（含 `id` / `modelName` / `model` / `content`；不再含 `endpoint`，endpoint 由后端按 model 名从 `PRISM_ANALYZER_API_KEYS` 查） |
| `priorMessages` | array | 否 | 前序 AI 发言列表（后端只取最近 5 条作为对比上下文） |

**SSE 事件**（`text/event-stream`，`data:` 行负载 JSON）：

| 事件 type | 说明 |
|------|------|
| `delta` | 流式证据片段（LLM 输出逐 token 推回） |
| `final` | 终态 JSON：`{ "label": "consensus"\|"divergence"\|"neutral", "evidence": "...", "analyzer": "..." }` |
| `fallback` | 自评失败（无对应 model 配置 / 上游调用失败 / 解析失败），前端转调 `POST /api/analyze` 同步回退 |

**示例**：

```
data: {"type":"delta","content":"这条发言"}
data: {"type":"delta","content":"与前文在"}
data: {"type":"final","label":"consensus","evidence":"这条发言与前文在 X 上达成共识","analyzer":"DeepSeek"}
```

无 Key 场景返回：

```
data: {"type":"fallback","reason":"no_key"}
```

### `POST /api/analyze`

**回退路径**：对一组 AI 发言进行共识/分歧启发式分析（基于关键词 Jaccard 2-gram 相似度）。当 `/api/analyze/stream` 自评失败、未配 `PRISM_ANALYZER_API_KEYS`、或模拟模式时使用。

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
