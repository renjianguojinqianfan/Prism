# 发版文档检查清单

> 发版前逐项检查文档准确性，确认无过期信息。

## 1. 依赖文件（source of truth）

这些文件是版本号的唯一真实来源，必须准确：

| 文件 | 检查内容 |
|------|---------|
| [backend/requirements.txt](../../backend/requirements.txt) | fastapi / uvicorn / pydantic / httpx 版本下限 |
| [backend/requirements-dev.txt](../../backend/requirements-dev.txt) | pytest / pytest-asyncio / respx 版本下限 |
| [frontend/package.json](../../frontend/package.json) | vite / vitest / @vitejs/plugin-react / react / marked 版本 |

**验证方法**：读取文件内容，与 Dependabot alerts 页面交叉对比，确认无未处理的漏洞。

## 2. 活文档（需同步更新）

| 文档 | 检查内容 | 是否含版本号 |
|------|---------|-------------|
| [AGENTS.md](../../AGENTS.md) | 技术栈描述、常用命令、行为边界 | 否（描述性文字） |
| [docs/context.md](../../docs/context.md) | 架构说明、API 端点、文件结构 | 否 |
| [README.md](../../README.md) | 快速演示、安装命令、技术栈 | 否 |
| [Makefile](../../Makefile) | verify 目标包含的步骤 | 否 |

**检查要点**：
- 技术栈名称是否准确（如 "Vite" 而非 "Webpack"）
- 安装命令是否可执行（`npm install` / `pip install -r requirements.txt`）
- 文件路径引用是否有效

## 3. CI/CD 配置

| 文件 | 检查内容 |
|------|---------|
| [.github/workflows/ci.yml](../../.github/workflows/ci.yml) | 触发分支、Node/Python 版本、permissions |
| [.github/workflows/codeql.yml](../../.github/workflows/codeql.yml) | 语言矩阵、permissions |
| [.github/dependabot.yml](../../.github/dependabot.yml) | 三个生态、schedule、ignore 规则 |

**检查要点**：
- Node.js 版本与 package.json engines 一致（当前 20）
- Python 版本与后端一致（当前 3.11）
- CI 中的 test/typecheck/build 步骤与 Makefile 一致

## 4. 规划文档（.trae/documents/ 和 .trae/specs/）

这些是**历史记录**，不需要更新版本号。但需确认：

- [ ] 无文件引用了已不存在的路径
- [ ] 无文件描述了与当前行为矛盾的功能

## 5. Git Hooks

| 文件 | 检查内容 |
|------|---------|
| `.git/hooks/pre-commit` | 存在且可执行，运行 `make verify` |
| `.git/hooks/commit-msg` | 存在且可执行，校验 commit message 格式 |

## 检查结果记录

将检查结果记录到 [release-checklist-record.md](./release-checklist-record.md)。
