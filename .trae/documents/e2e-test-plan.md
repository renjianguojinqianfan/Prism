# Prism 端到端测试计划

> 使用 Playwright MCP 工具驱动浏览器执行，无需引入新依赖。
> AI 按本计划逐条执行，每条测试记录通过/失败。

## 前置条件

1. 启动前端开发服务器：`cd frontend && npm run dev`（端口 5173）
2. 后端测试需要：`cd backend && uvicorn main:app --port 8000`，并设置 `PRISM_ANALYZER_API_KEYS` 环境变量
3. 每条测试前通过 `playwright_evaluate` 执行 `localStorage.clear()` 清空状态，再 `playwright_navigate` 刷新页面

## 测试套件

### A. 基础 UI 渲染（5 条）

| # | 测试名 | 前置 | 步骤 | 断言 |
|---|--------|------|------|------|
| A1 | 空状态首次加载 | 无模型配置 | navigate 5173 | visible_text 含"配置模型"；设置面板自动展开；MessageList 显示推荐话题 |
| A2 | 推荐话题点击填入 | A1 | click 推荐话题按钮 | input 框填入话题文本；未自动发起讨论 |
| A3 | 空输入发起被拦截 | A1 | 点击发起按钮 | visible_text 含"请输入话题或想法"toast |
| A4 | 无启用模型发起被拦截 | 配置1个模型但 disabled | 填入话题 + 点击发起 | visible_text 含"请至少启用一个模型" |
| A5 | 设置面板开关 | 有模型配置 | click 配置按钮 -> click 关闭按钮 | 面板消失/出现 |

### B. 模拟模式讨论完整流程（8 条）

| # | 测试名 | 前置 | 步骤 | 断言 |
|---|--------|------|------|------|
| B1 | 单模型单轮讨论 | 添加1个 deepseek 模板 + 启用 + 模拟模式 + maxRounds=1 | 填话题"测试" + 发起 | 消息序列：system话题 -> user话题 -> assistant发言(逐字符) -> system结束；assistant消息最终 thinking=false；第一条AI发言无标签(baseline) |
| B2 | 双模型单轮讨论 | 2个模型 + maxRounds=1 | 发起 | 两个模型依次发言；第二条AI发言有标签(consensus/divergence/neutral) |
| B3 | 双模型两轮讨论 | 2个模型 + maxRounds=2 | 发起 | 4条AI发言 + 结束消息；第2轮发言引用第1轮内容（simulator模板含prevNotes） |
| B4 | 模拟模式标签回退 | 同B2 | 发起 + 等待完成 | 后端未启动时，标签 analyzer 为"本地启发式"；toast 含"已使用本地分析" |
| B5 | 讨论结束后状态 | B1完成 | 检查按钮区 | 暂停/跳过/重置按钮消失（discussionActive=false）；可重新发起 |
| B6 | RoleBar 发言脉冲 | B1进行中 | screenshot | 当前发言模型有 speaking-pulse 动画样式 |
| B7 | 消息列表自动滚动 | B3进行中 | evaluate 检查 scrollTop | 滚动条接近底部 |
| B8 | 轮次显示 | B3进行中 | get_visible_text | 含"第1轮"/"第2轮"文本 |

### C. 讨论控制时序（10 条）

| # | 测试名 | 前置 | 步骤 | 断言 |
|---|--------|------|------|------|
| C1 | 模拟模式暂停 | B1进行中 | click 暂停 -> 等1s -> screenshot -> click 继续 | 暂停时内容停止增长；继续后恢复；按钮图标切换 pause/play |
| C2 | 模拟模式跳过 | B1进行中 | click 跳过 | 当前发言瞬间填满全部内容；thinking 变 false；toast"已跳过当前发言者" |
| C3 | 模拟模式重置 | B1进行中 | click 重置 | 消息清空；按钮组消失；toast"讨论已重置"；可重新发起 |
| C4 | 重置后立即重新发起 | C3后立即 | 填新话题 + 发起 | 不残留旧消息；新讨论正常进行（discussion token 机制） |
| C5 | 讨论中插话 | B1进行中（双模型） | 填入插话内容 + 点击插话 | toast"你的观点已加入讨论"；user消息出现；当前发言不被打断；下一模型发言历史含插话内容 |
| C6 | 插话不影响当前发言 | B1进行中 | 插话后 evaluate 检查当前发言消息 | 当前 assistant 消息 content 不含插话文本 |
| C7 | 连续跳过多模型 | 3模型 + maxRounds=1 | 发起后连续 click 跳过 | 每个模型都被跳过；消息含跳过内容或"[已跳过]"；讨论正常结束 |
| C8 | 暂停后重置 | 暂停状态 | click 重置 | 重置成功；paused 状态清除 |
| C9 | 暂停后跳过 | 暂停状态 | click 跳过 | 跳过生效（skipRequested）；继续后不卡在暂停 |
| C10 | 讨论中按钮状态 | B1进行中 | 检查 ModelSelector | enabled checkbox disabled；发起按钮文案为"插话" |

### D. 模型配置与 localStorage（7 条）

| # | 测试名 | 前置 | 步骤 | 断言 |
|---|--------|------|------|------|
| D1 | 快速模板添加 | 空配置 | click deepseek模板 | 模型卡片出现；endpoint/model/systemPrompt 已填；apiKey 为空；徽章"未配置" |
| D2 | 保存持久化 | D1 + 填入 apiKey | click 保存 -> 刷新 | localStorage prism_models 含完整配置；刷新后模型列表保留 |
| D3 | 未保存不持久化 | D1 + 改 endpoint | 直接刷新（不保存） | localStorage 为旧值；模型列表回到保存前状态 |
| D4 | 删除自定义模型 | D1 | click 删除按钮 | 模型从列表移除（需保存才持久化） |
| D5 | legacy key 迁移 | evaluate 写入 aiRoundtable_models | 刷新 | localStorage prism_models 有数据；aiRoundtable_models 被删除 |
| D6 | 损坏 JSON 恢复 | evaluate 写入 prism_models='invalid' | 刷新 | 模型列表为空；设置面板自动展开 |
| D7 | 自定义模型默认值 | 空配置 | click 添加自定义模型 | endpoint 为占位 URL；apiKey 空；systemPrompt 含默认值；custom=true |

### E. XSS 防护（6 条）

| # | 测试名 | 前置 | 步骤 | 断言 |
|---|--------|------|------|------|
| E1 | script 标签转义 | 模拟模式 | 发起讨论，evaluate 注入 `<script>alert(1)</script>` 到消息 content | get_visible_html 不含 `<script>`；含 `&lt;script&gt;` |
| E2 | javascript 链接拦截 | 模拟模式 | evaluate 注入 `[click](javascript:alert(1))` | html 不含 `javascript:alert`；href 为空 |
| E3 | href 双引号注入阻断 | 模拟模式 | evaluate 注入 `[x](<https://evil.com" onmouseover="alert(1)>)` | html 不含 `onmouseover=` 作为独立属性；含 `&quot;` |
| E4 | image src 双引号注入 | 模拟模式 | evaluate 注入 `![x](<https://evil.com" onerror="alert(1)>)` | html 不含 `onerror=` 作为独立属性 |
| E5 | data 图片移除 | 模拟模式 | evaluate 注入 `![x](data:image/png;base64,xxx)` | html 不含 `<img` |
| E6 | thinking 状态纯文本 | B1进行中 | evaluate 检查 thinking 消息的 DOM | content 为 escapeHtml 输出（纯文本），无 Markdown 渲染 |

> 注：E1-E5 通过 `playwright_evaluate` 调用 `renderMarkdown(payload)` 直接验证输出 HTML，比间接注入消息更精确。

### F. 后端集成（5 条）

| # | 测试名 | 前置 | 步骤 | 断言 |
|---|--------|------|------|------|
| F1 | health 端点 | 后端运行 | playwright_get /api/health | 响应 `{status: "ok"}` |
| F2 | analyze 同步分析 | 后端运行 | playwright_post /api/analyze 带2条消息 | 返回 tags 数组；label 在 consensus/divergence/neutral 中 |
| F3 | analyze 空消息 | 后端运行 | playwright_post /api/analyze 空消息 | 返回 `{tags: []}` |
| F4 | stream no_key 回退 | 后端运行但无 PRISM_ANALYZER_API_KEYS | playwright_post /api/analyze/stream | SSE 返回 `{"type":"fallback","reason":"no_key"}` |
| F5 | stream 正常自评 | 后端运行 + 配置 PRISM_ANALYZER_API_KEYS | playwright_post /api/analyze/stream | SSE 含 delta 事件 + final 事件；final label 合法 |

### G. 错误处理与回退（6 条）

| # | 测试名 | 前置 | 步骤 | 断言 |
|---|--------|------|------|------|
| G1 | 后端不可达 -> 本地启发式 | 后端未启动 + 模拟模式 | 发起讨论 | 标签 analyzer 为"本地启发式"；toast"已使用本地分析" |
| G2 | streamAnalysis fallback -> Jaccard | evaluate mock fetch /api/analyze/stream 返回 fallback event | 模拟模式发起 | 标签 analyzer 为"本地启发式"（Jaccard 回退） |
| G3 | 三重回退链路 | evaluate mock fetch 全部失败 | 模拟模式发起 | 最终使用 localHeuristicAnalyze；标签 analyzer"本地启发式" |
| G4 | 真实模式无 Key 跳过 | 模型无 apiKey + 关闭模拟 | 发起 | system 消息"未配置API Key，跳过"；无 assistant 消息 |
| G5 | 真实模式 API 错误 | evaluate mock fetch 返回 500 + 关闭模拟 | 发起 | 消息含"[调用失败]"；toast 含"调用出错" |
| G6 | 真实模式网络错误 | evaluate mock fetch 抛 TypeError + 关闭模拟 | 发起 | 消息含"[调用失败] Failed to fetch"；toast 错误提示 |

### H. 导出功能（3 条）

| # | 测试名 | 前置 | 步骤 | 断言 |
|---|--------|------|------|------|
| H1 | 空讨论导出 | 无消息 | click 导出 | toast"暂无讨论内容可导出" |
| H2 | 有内容导出 | B1完成 | click 导出 | 触发下载事件；文件名含"棱镜"和日期 |
| H3 | 导出内容格式 | B1完成 | evaluate 读取导出文本 | 含"# 棱镜 - 讨论记录"；含话题标题；含各模型发言 |

## 执行策略

1. **分批执行**：A -> D -> B -> C -> E -> F -> G -> H（先验证基础设施，再测核心流程）
2. **每条测试前**：`evaluate` 执行 `localStorage.clear()` + `location.reload()` 重置状态
3. **mock fetch 模式**：`evaluate` 注入 `window.fetch = (url, opts) => { ... }` 替换原生 fetch，测试后 `location.reload()` 恢复
4. **异步等待**：讨论发起后用 `evaluate` 轮询 `document.querySelector('[class*="msg-content"]')` 或检查消息数量，等待发言完成
5. **截图存档**：关键步骤 `playwright_screenshot` 记录视觉状态
6. **结果记录**：每条测试记录 PASS/FAIL + 失败原因 + 截图

## 预期发现的问题

基于代码审查，以下场景可能暴露已知或潜在问题：
- C4（快速 reset 重发）：验证 discussion token 修复是否有效
- C7（连续跳过）：真实模式下 skipRequested 不重置（模拟模式无此问题）
- G5/G6（API 错误）：错误消息经 Markdown 渲染，若含恶意链接可能触发 XSS（E3 已覆盖防护）
