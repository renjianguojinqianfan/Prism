# Checklist

> 标记说明：`[x]` 已验收 / `[ ]` 待验收；`(P1)` 为高优先级规划项

## 后端（main.py / requirements.txt / .env.example）
- [x] `requirements.txt` 含 fastapi、uvicorn、pydantic 且可被 `pip install` 解析
- [x] `GET /api/health` 返回 `{"status":"ok"}`
- [x] CORS 通过 `PRISM_CORS_ORIGINS` 环境变量配置白名单，默认含本地 5173/4173 端口，不再使用 `*`
- [x] `allow_methods` 限定 `GET/POST/OPTIONS`，`allow_headers` 限定 `Content-Type/Authorization`
- [x] `POST /api/analyze` 在空 `messages` 输入下返回 `{"tags":[]}` 且 HTTP 200
- [x] `POST /api/analyze` 在多条消息输入下返回每条对应一个 `{id,label,score,evidence}` 元素
- [x] `analyze()` 算法：Jaccard 2-gram + 阈值 HIGH=0.14 / LOW=0.11，与前端一致
- [x] `.env.example` 含 `PRISM_PORT` 与 `PRISM_CORS_ORIGINS` 示例值，未提交真实 Key

## 前端架构（frontend/）
- [x] `tsconfig.json` 开启 `strict` + `noUnusedLocals` + `noUnusedParameters`
- [x] `npm run typecheck` 通过
- [x] `npm run build` 通过（tsc -b && vite build）
- [x] 状态统一在 `DiscussionContext.tsx` 用 useReducer + useRef，无第三方状态库
- [x] 纯 dispatch 回调用 useCallback 包裹稳定引用
- [x] 依赖 state 的函数（runDiscussion/startDiscussion/analyzeMessages 等）移入 useMemo 内部并正确声明依赖
- [x] 组件目录约定：`components/` 放 UI、`services/` 放纯逻辑、`utils/` 放工具、`store/types.ts` 集中类型

## SSE 流式调用（services/api.ts）
- [x] `streamChat()` 以 `stream: true` 调用 OpenAI 兼容端点
- [x] 逐 token 解析 `data: ` SSE 行，`[DONE]` 结束
- [x] `response.body` 非空检查，null 时抛 `Error('API响应无响应体')`
- [x] 支持 `AbortSignal` 中断，`AbortError` 被上层静默吞掉不弹 toast
- [x] `buildAPIHistory()` 拼接 system + 历史 + 当前发言提示

## 真实分析与本地回退（services/analyzer.ts）
- [x] `localHeuristicAnalyze()` 停用词表与后端 `_STOPWORDS` 完全一致
- [x] 分词逻辑（英文 ≥2 字符、中文 2-gram）与后端 `_tokenize` 一致
- [x] Jaccard 阈值 0.14/0.11 与后端一致
- [x] `fetchAnalysis()` 4s 超时 + try/catch 回退，失败返回 null
- [x] 回退时 toast 提示"已使用本地分析（后端不可用或模拟模式）"

## 模拟模式（services/simulator.ts）
- [x] `generateSimReply()` 引用上一条 AI 发言前 60 字（去空白）
- [x] 按 `(round - 1) % pool.length` 确定性取模板，同话题可复现
- [x] 首轮首位（无 prevAi）不插入引用片段
- [x] 四个预设模型（deepseek/kimi/glm/qwen）各有 3 个模板

## Markdown 渲染与 XSS 防护（utils/markdown.ts + MessageBubble.tsx）
- [x] marked v12 封装，`walkTokens` 对 `type === 'html'` 的 token 调用 `escapeHtml`
- [x] `<script>` / `<img onerror>` 等恶意 HTML 被转义为纯文本，不执行
- [x] 思考态（`msg.thinking === true`）走 `escapeHtml` + 打字光标，不经过 marked
- [x] 标签文案：consensus → 「共识 💡」、divergence → 「分歧 ⚡」、neutral → 「中立 ·」
- [x] 三种 label 在气泡右上角正确渲染对应颜色

## 安全加固
- [x] CORS 不再使用 `*`，改为环境变量白名单
- [x] 无硬编码 API Key（Key 通过用户输入 + localStorage 持久化）
- [x] `response.body` 非空防御检查
- [x] `showToast` 的 setTimeout 用 `toastTimersRef` 追踪，卸载时全部清理
- [x] `dismissToast` 清理对应定时器并从 Map 删除
- [x] localStorage 键从 `aiRoundtable_models` 迁移到 `prism_models`，旧键数据自动迁移
- [x] 旧键保留不删（避免数据丢失争议）

## 文档（readme.md / agents.md / .env.example）
- [x] `readme.md` 功能列表反映 React+TS 现状（无"规划中"过期表述）
- [x] `readme.md` 命令参考表与 `package.json` scripts 一致
- [x] `readme.md` 环境变量表 `PRISM_CORS_ORIGINS` 描述与代码一致（非"未读取此变量"）
- [x] `readme.md` API 参考与 `main.py` 路由/Pydantic 模型一致
- [x] `agents.md` 文件清单含 `frontend/src/` 全部组件
- [x] `agents.md` 标注前后端阈值同步约束
- [x] `.env.example`（根目录）`PRISM_CORS_ORIGINS` 示例值含 5173/4173 端口
- [x] `.env.example`（frontend）含 `VITE_ANALYZE_ENDPOINT`

## 端到端
- [x] 启动后端后发起讨论，标签为真实分析结果
- [x] 后端关闭后再次发起讨论，标签由本地启发式产生且无报错
- [x] 模拟模式下不依赖后端也能给出非 Mock 的标签
- [x] 真实模式下流式输出逐 token 渲染，可被"跳过"中断
- [x] 模拟模式多轮讨论连贯（后发言者引用前发言片段）
- [x] Markdown 回复正确渲染（加粗/列表/代码块/引用）
- [x] 含 HTML 标签的回复被转义，不执行脚本

## 观点图谱可视化（P1 规划，待验收）
- [ ] (P1) `d3` 与 `@types/d3` 已安装并出现在 `package.json` dependencies
- [ ] (P1) `components/OpinionGraph.tsx` 已创建，props 接收 messages + tags
- [ ] (P1) 讨论结束后图谱在消息列表上方/侧边渲染
- [ ] (P1) 节点颜色按 label（consensus 绿/divergence 橙/neutral 灰）
- [ ] (P1) 边宽与透明度映射两两 Jaccard 相似度
- [ ] (P1) 节点可拖拽，hover 高亮邻接节点与边
- [ ] (P1) 点击节点 → 消息列表滚动到对应气泡并高亮
- [ ] (P1) 关闭按钮 / 发起新讨论时图谱收起
- [ ] (P1) 窄屏折叠为可展开抽屉
- [ ] (P1) `npm run typecheck` + `npm run build` 通过
- [ ] (P1) `readme.md` 功能列表与 `agents.md` 文件清单已同步图谱组件
