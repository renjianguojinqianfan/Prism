# 棱镜 (Prism) 工程工作流

> 本仓库用 Matt Pocock 工程技能体系组织迭代。技能配置（issue tracker / triage 标签 / domain docs）见同目录 `issue-tracker.md` / `triage-labels.md` / `domain.md`。

## 一轮修复/迭代的标准路径

1. **配置（一次性）**：`/setup-matt-pocock-skills` — 确认 issue tracker（GitHub，`gh` CLI）、triage 标签、domain docs 已就绪
2. **计划 → Tickets**：`/to-tickets` — 把计划/规范拆成 tracer-bullet tickets 发布到 GitHub Issues；每个 ticket 声明 blocking 边并标 `ready-for-agent`；发布前先 `gh label list` 确认 triage 标签存在
3. **实施**：`/implement`（优先 `/tdd`）— 从 frontier（无 blocker）开始逐 ticket 实施；每提交独立可验证（pre-commit 自动跑 test + typecheck）
4. **审查**：`/code-review` — Standards（规范轴）+ Spec（需求轴）双轴并行审查；发现的问题修复后补提交，不合并进原提交
5. **收尾**：`/neat-freak` — 同步文档/规则/工作区，`git push` 后批量关闭已完成 issues

## 质量门禁

- `make verify` = `test:run` + `typecheck` + `build`（等价三绿）
- 提交规范：`<type>(<scope>): <subject>`，中文 subject，分批次小步提交
- 完成定义：三绿 + 用户确认；提交由 hooks（`.githooks/`）自动把关

## 实践记录（2026-08-13）

一轮 14-ticket 修复（#18-#31）按 P1 安全 → P2 质量 → P2.5 SSE 提取 → P3 引擎重构 → P4 低优先级推进，产出 16 提交 + 131 测试全绿。计划与执行状态见 `.trae/documents/codebase-fix-plan-2026-07-15.md`。
