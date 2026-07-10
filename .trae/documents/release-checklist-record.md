# 发版检查记录

> 每次发版时复制此模板，逐项确认并填写结果。

## 版本信息

- 版本号：v0.1.0
- 发布日期：2026-07-10
- 最后 commit：___________
- 总 commit 数：___________

## 1. 代码状态

| 检查项 | 结果 | 备注 |
|--------|------|------|
| main 分支最新 | ☐ | `git pull prism main` |
| 无未提交改动 | ☐ | `git status` 干净 |
| make verify 通过 | ☐ | 82 前端测试 + 63 后端测试 + typecheck + build |

## 2. 文档检查

| 检查项 | 结果 | 备注 |
|--------|------|------|
| backend/requirements.txt 版本准确 | ☐ | |
| backend/requirements-dev.txt 版本准确 | ☐ | |
| frontend/package.json 版本准确 | ☐ | |
| AGENTS.md 技术栈描述准确 | ☐ | |
| docs/context.md 架构说明准确 | ☐ | |
| README.md 安装命令可执行 | ☐ | |
| ci.yml 触发条件与版本正确 | ☐ | |
| codeql.yml 语言矩阵正确 | ☐ | |
| dependabot.yml 三生态配置正确 | ☐ | |
| pre-commit hook 存在且可执行 | ☐ | |
| commit-msg hook 存在且可执行 | ☐ | |

## 3. 端到端测试

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 后端健康检查 200 | ☐ | `{"status":"ok"}` |
| 前端页面正常渲染 | ☐ | 标题 + 输入框 + 模型配置 |
| 控制台无 [error] 日志 | ☐ | 404 已修复 |
| favicon 加载正常（无 404） | ☐ | 只请求 /vite.svg |
| 模拟模式 3 模型添加成功 | ☐ | 显示 "3 位参与者" |
| 话题输入成功 | ☐ | textarea 填充 |
| 讨论发起成功 | ☐ | 第 1 轮开始 |
| 2 轮讨论完整完成 | ☐ | "第 2 / 2 轮" |
| 每条发言有共识/分歧标签 | ☐ | "共识 💡" 或 "分歧 ⚡" |
| 自评标签正常 | ☐ | "本地启发式"（回退）或 LLM 自评 |
| 讨论控制按钮可用 | ☐ | 暂停/跳过/重置 |
| 截图已保存 | ☐ | |

## 4. 安全检查

| 检查项 | 结果 | 备注 |
|--------|------|------|
| Dependabot alerts 已处理 | ☐ | 无未处理的安全告警 |
| Secret scanning 无告警 | ☐ | |
| CodeQL 扫描无严重告警 | ☐ | |
| CI workflow 权限最小化 | ☐ | `permissions: contents: read` |

## 5. Release Notes

| 检查项 | 结果 | 备注 |
|--------|------|------|
| release notes 已生成 | ☐ | `.trae/documents/release-notes-v0.1.0.md` |
| 功能特性完整 | ☐ | |
| 安全加固记录 | ☐ | |
| 依赖升级记录 | ☐ | |
| 已知问题记录 | ☐ | |
| 质量状态记录 | ☐ | 测试数、CI 状态 |

## 6. Tag 与 Release

| 检查项 | 结果 | 备注 |
|--------|------|------|
| git tag 已创建 | ☐ | `git tag v0.1.0` |
| tag 已推送 | ☐ | `git push prism v0.1.0` |
| GitHub Release 已创建 | ☐ | `gh release create` |
| Release notes 内容完整 | ☐ | |
| GitHub 仓库主页可见 | ☐ | |

## 签署

- 检查人：___________
- 检查时间：___________
- 全部通过：☐
