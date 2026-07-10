# 发版端到端测试方法

> 发版前用 Playwright MCP 执行端到端测试，验证核心功能正常。

## 前置条件

- 前端依赖已安装（`cd frontend && npm install`）
- 后端依赖已安装（`cd backend && pip install -r requirements-dev.txt`）
- Playwright MCP 工具可用

## 1. 启动服务

```bash
# 终端 1：后端
cd backend && uvicorn main:app --port 8000

# 终端 2：前端
cd frontend && npm run dev
```

确认输出：
- 后端：`Uvicorn running on http://127.0.0.1:8000`
- 前端：`Local: http://localhost:5173/`

## 2. 后端健康检查

```
MCP: playwright_get
url: http://localhost:8000/api/health
```

**期望**：Status 200，Response `{"status":"ok"}`

## 3. 前端页面加载

```
MCP: playwright_navigate
url: http://localhost:5173/
```

**期望**：页面正常渲染，标题 "Prism" + 副标题 "多AI视角碰撞 · 共识/分歧一目了然"

## 4. 控制台错误检查

```
MCP: playwright_console_logs
```

**期望**：
- 无 `[error]` 级别日志（404、JS 异常等）
- `[verbose]` 级别的 "Password field not in form" 是已知警告，可接受
- `[info]` 级别的 React DevTools 提示正常

## 5. favicon 加载验证

```
MCP: playwright_evaluate
script: performance.getEntriesByType('resource').filter(e => e.name.includes('favicon') || e.name.includes('vite.svg')).map(e => e.name)
```

**期望**：只有 `/vite.svg`，无 `/favicon.ico` 的 404 请求。

## 6. 模拟模式讨论测试

### 6.1 添加模型

```
MCP: playwright_evaluate
script: |
  const addModel = (name) => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.textContent.includes(name) && b.textContent.includes('+'));
    if (btn) btn.click();
  };
  addModel('DeepSeek');
  setTimeout(() => addModel('Kimi'), 300);
  setTimeout(() => addModel('GLM'), 600);
```

**期望**：页面显示 "3 位参与者"。

### 6.2 输入话题

```
MCP: playwright_fill
selector: textarea
value: AI是否会取代人类创造力？
```

**期望**：textarea 填充成功。

### 6.3 关闭可能弹出的模态框

如果添加模型时弹出了配置模态框，需先关闭：

```
MCP: playwright_evaluate
script: |
  const modal = document.querySelector('div.fixed.inset-0.z-40');
  if (modal) modal.remove();
```

### 6.4 发起讨论

```
MCP: playwright_evaluate
script: |
  const btn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim() === '发起');
  if (btn) { btn.click(); 'clicked'; } else { 'not found'; }
```

### 6.5 等待讨论完成

```
MCP: playwright_evaluate
script: new Promise(resolve => setTimeout(() => resolve('done'), 15000));
```

等待 15 秒让 2 轮讨论完成。

### 6.6 验证讨论结果

```
MCP: playwright_get_visible_text
```

**期望**：
- 显示 "讨论话题：AI是否会取代人类创造力？"
- 3 个模型（DeepSeek/Kimi/GLM）各有发言
- 每条发言带 "共识 💡" 或 "分歧 ⚡" 标签
- 自评标签为 "本地启发式"（未配置 PRISM_ANALYZER_API_KEYS 时的预期回退行为）
- 显示 "第 2 / 2 轮"（讨论完成）
- 讨论控制按钮（暂停/跳过/重置）可用

### 6.7 截图存档

```
MCP: playwright_screenshot
name: release-e2e-result
fullPage: true
```

## 7. 后端分析端点测试（可选）

如果配置了 `PRISM_ANALYZER_API_KEYS` 环境变量，可测试 LLM 自评：

```
MCP: playwright_post
url: http://localhost:8000/api/analyze/stream
```

**期望**：返回 SSE 流式响应，包含 `consensus` 或 `dissent` 标签。

未配置时跳过此步骤，回退到 Jaccard 启发式是预期行为。

## 8. 停止服务

测试完成后停止前后端服务。

## 通过标准

| 检查项 | 必须 |
|--------|------|
| 后端健康检查 200 | ✅ |
| 前端页面正常渲染 | ✅ |
| 控制台无 [error] 日志 | ✅ |
| 模拟模式 2 轮讨论完整完成 | ✅ |
| 每条发言有共识/分歧标签 | ✅ |
| 讨论控制按钮可用 | ✅ |
