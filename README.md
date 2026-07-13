# 棱镜 (Prism)

> 多AI视角碰撞 · 共识/分歧一目了然

## 产品定位与核心功能

「棱镜」是一个多 AI 讨论台。用户输入一个问题，可同时唤起用户自填的多个 AI 模型进行圆桌讨论（建议使用不同厂商的模型以让观点碰撞更充分）。名字取自"一束白光通过棱镜折射出七色光谱"——一个问题进入，多个 AI 从不同视角折射出各自的观点。

**核心功能：**

- **一次提问，多方 AI 串行回答**：用户提出问题后，多个模型依次参与讨论，后发言者能看到前文
- **深色赛博朋克 UI**：沉浸式群聊界面，带发光动效
- **模拟 / 真实模式切换**：无需 API Key 即可体验，也可接入真实模型
- **模拟模式多轮连贯对话**：模拟模式下多轮讨论自动引用前文观点，保证对话连贯性
- **模型复选框选择器**：输入框上方复选框自由勾选参与讨论的模型，默认全选
- **讨论控制**：暂停/继续、跳过当前发言者、一键重置
- **讨论记录导出**：一键导出 Markdown 格式讨论记录
- **共识 / 分歧实时自评**：每条 AI 发言结束后，由发言者自己的 LLM 对自己发言做评估并实时流式推送回前端，气泡右上角标注「共识 💡 / 分歧 ⚡ / 中立 ·」并附加「· {analyzer}自评」子文案。第一条发言作为基准不带标签，从第二条开始评估。两级回退：自评失败 -> 前端本地启发式
- **Markdown 渲染 + XSS 防护**：AI 回复支持 Markdown 语法（加粗、列表、代码块、引用等），通过 marked `walkTokens` 转义 HTML token 防止 XSS 攻击
- **自定义模型**：支持添加任意兼容 OpenAI `/v1/chat/completions` 协议的模型端点

## 快速体验

两种方式任选其一，默认均开启**模拟模式**，无需 API Key 即可看到多 AI 圆桌讨论效果。

### 方式一：单文件原型

直接双击根目录 `index.html` 即可在浏览器打开。为避免 `file://` 协议限制，推荐用本地静态服务器打开：

```bash
python -m http.server 8080
# 浏览器访问 http://localhost:8080/index.html
```

> 注意：`index.html` 依赖联网 CDN（Tailwind / Google Fonts / Font Awesome / marked），首次打开需联网。需现代浏览器（推荐 Chrome 或 Edge 最新版）。

### 方式二：React 完整版

功能完整（含设置面板、自定义模型、导出、发言者自评流式分析等）。

```bash
cd frontend
npm install
npm run dev
# 浏览器访问 http://localhost:5173
```

## 接入真实模型

1. 点击页面右上角「配置模型」（首次进入会自动展开配置面板）
2. 点击「快速添加模板」一键填入端点/模型名/角色设定（DeepSeek / Kimi / GLM / 通义 / Mimo），或点击「添加自定义模型」手填任意 OpenAI 兼容端点
3. 为每个模型填写 API Key（发言用）
4. 关闭「模拟模式」开关
5. 发起讨论，即可调用真实模型 API（流式输出）

## 开发与测试

### 单元测试

项目已搭建前端单元测试基础设施，提交前需保证全绿。

**前端（vitest，116 用例 / 8 文件）**：

```bash
cd frontend
npm install
npm run test:run      # 一次性运行
npm test              # watch 模式
```

覆盖范围：`services/{simulator,api,analyzer}.test.ts` / `store/{reducer,loadModels}.test.ts` / `utils/{escape,markdown,sleep}.test.ts`。

测试基础设施说明：
- 前端 `vitest.config.ts` 配置 jsdom 环境 + globals 模式；`src/vite-env.d.ts` 引入 `vitest/globals` 类型
- 为可测试性，源文件做了最小 export 调整（`analyzer.ts` 的 `tokenize` / `jaccard` / `_isCjk`；`DiscussionContext.tsx` 的 `reducer` / `State` / `Action`），无行为变化

### 类型检查与构建

```bash
cd frontend
npm run typecheck     # tsc --noEmit，0 错误
npm run build         # tsc -b && vite build，产物在 frontend/dist/
```

### 联调验证

启动前端后，模拟模式下发起一次多模型讨论（推荐 4 模型 × 2 轮），观察：

- 每条 AI 发言后即时落定「共识 💡 / 分歧 ⚡ / 中立 ·」标签（带「· {analyzer} 自评」后缀）
- 讨论结束「讨论结束」系统消息出现后，已有标签不被覆盖

### CI/CD

仓库已配置以下自动化流水线：

- **GitHub Actions CI**（`.github/workflows/ci.yml`）：push / PR 时自动运行前端测试
- **CodeQL 代码安全扫描**（`.github/workflows/codeql.yml`）：覆盖 TypeScript，push / PR 时触发
- **Dependabot**（`.github/dependabot.yml`）：两生态（npm / github-actions）每周检查依赖更新，自动创建升级 PR（忽略 major 版本）

发版流程参见 `.trae/documents/release-workflow.md`。
