# 棱镜 (Prism) v0.1.1 Release Notes

**发布日期**：2026-07-12
**版本号**：v0.1.1（安全修复 + 测试增强）
**Tag 名**：`v0.1.1`
**上一版本**：v0.1.0（2026-07-10）

---

## 变更概要

本次为 patch 版本，聚焦 XSS 安全修复与测试覆盖增强，无新功能、无破坏性变更。

---

## 安全修复

### index.html XSS 全面加固

- `renderMarkdown` 注册 link/image renderer 协议白名单（`https?/mailto/tel`），过滤 `javascript:`/`vbscript:`/`data:`
- `escapeHtml` 增加双引号/单引号转义，对齐 React 版 `escape.ts`
- CDN 锁定 `marked@12`（从无版本锁定改为与 React 版 `^12.0.2` 一致）
- 9 处输出点转义：model.name（541/567/646/796/1186）、analyzer（1093）、系统消息（625）、showToast（1407）、textarea systemPrompt（1216）

### React 版同步修复

- `markdown.ts` image renderer `alt` 属性转义（`escapeHtml(text)`），防止属性逃逸注入 `onerror`

---

## 测试增强

前端单元测试 **82 -> 105**（+23 用例）：

| 测试文件 | 新增 | 覆盖范围 |
|----------|------|----------|
| `api.test.ts` | +8 | streamChat：正常流/跨buffer/非200/无body/非data行/JSON失败/abort透传/网络错误 |
| `analyzer.test.ts` | +11 | streamAnalysis（7：final/fallback/非200/无body/跨buffer/畸形行/仅delta）+ fetchAnalysis（4：ok/非ok/无tags/网络异常）|
| `loadModels.test.ts` | +4（新建）| localStorage 迁移：无存储/新key/legacy迁移/损坏JSON |

- SSE mock 行尾从 `\n` 改为 `\n\n`（17 处），对齐后端标准 SSE 格式
- 导出 `loadModels` 支持单测（零行为变化，沿用 `3a10313` 先例）

---

## 文档

- 新增 `docs/testing.md` 测试指南（测试体系/基建/用例/e2e/运行命令/设计原则）
- `.gitignore` 忽略 `docs/roadmap.md` 私有规划文档

---

## 质量状态

- `npm run typecheck`：通过（TypeScript strict）
- `npm run test:run`：105/105 通过
- `npm run build`：成功
- `pytest`：63/63 通过
- 端到端测试：10/10 通过（Playwright MCP 驱动浏览器）
- 子代理 review：4 个代理（代码审查/安全/FastAPI/TDD）审查，H/M 问题全部修复

---

## 完整 Changelog（13 commits）

### Bug Fixes (6)

- `b1056d5` fix: 补齐 XSS 转义遗漏与 image alt 属性注入
- `e57b67e` fix: index.html 系统消息内容转义防 XSS
- `1cb51aa` fix: index.html modelName 多处输出转义防 XSS
- `78c62f4` fix: index.html renderMarkdown 增加链接协议白名单防 XSS
- `5ace6b7` fix: index.html modelName XSS 转义修复
- `28f9d81` fix: CI 添加 build 步骤并补全 AGENTS.md 目录结构

### Tests (4)

- `10cd158` chore: 测试 SSE mock 对齐后端格式与补网络错误用例
- `fc09739` chore: 导出 loadModels 并补充 localStorage 迁移测试
- `9a74da5` chore: 补充 streamAnalysis/fetchAnalysis 11 用例
- `7b6f880` chore: 补充 streamChat 流式调用层 7 用例

### Documentation (3)

- `ddd562d` docs: 添加测试指南文档并更新 gitignore
- `911f721` docs: 历史文档添加标注并精简重复描述
- `d76e3c6` docs: 修复 spec.md 和 checklist.md 过时引用

---

## 已知问题

（与 v0.1.0 相同）

- 分析 Key 需通过后端环境变量 `PRISM_ANALYZER_API_KEYS` 配置（JSON 字符串格式），未配置时自动回退至 Jaccard 启发式分析
- Jaccard 回退路径阈值（HIGH=0.14, LOW=0.11）前后端需保持一致，修改时需同步 `frontend/src/services/analyzer.ts` 与 `backend/app/config.py`
