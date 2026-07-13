# Git 压缩 + 拆分标准操作流程

> 当一系列小步提交完成后，需要将其合并为少量逻辑清晰的原子提交时使用。

## 触发条件

- 完成了一次大型重构，产生了大量小步提交（如 TDD 流程中每个 test+impl 各一个提交）
- 提交历史过于碎片化，不利于审阅和回溯
- 需要将开发过程的小步提交整理为面向审阅的语义化提交

## 前置检查步骤

```bash
# 1. 确认工作区干净（无未提交的修改）
git status --short

# 2. 确认当前提交历史
git log --oneline -20

# 3. 确认要压缩的范围（找到第一个要合并的提交的父提交哈希）
git log --oneline | head -20
```

## 核心操作

### 步骤 1：创建备份分支

```bash
# 用日期标记，便于回溯
git branch backup/squash-$(date +%Y%m%d)
```

> Windows PowerShell 等价：`git branch backup/squash-$(Get-Date -Format yyyyMMdd)`

### 步骤 2：软重置到压缩范围之前

```bash
# <父提交哈希> = 要压缩的第一个提交的父提交
git reset --soft <父提交哈希>
```

此时所有改动进入暂存区，工作区文件不变。

### 步骤 3：查看暂存区改动

```bash
git diff --cached --stat
```

### 步骤 4：按功能模块分组提交

分组原则：
- 按功能模块/变更性质划分，不按文件类型划分
- 每组应为逻辑独立、可单独审阅的原子化提交
- 依赖顺序：新功能/核心实现优先，清理/删除次之，文档最后
- 建议不超过 4 个提交；如超过需说明原因

```bash
# 逐组暂存并提交
git add <该组文件路径...>
git commit -m "<type>(<scope>): <subject>"
```

### 步骤 5：Review（git 压缩后、push 前执行）

**原则**：Tag 是版本锚点，一旦推送即永久绑定。因此 Review 必须在 Tag 之前完成。

#### 执行方式

1. 让 Agent 执行 `git diff <压缩起点>..HEAD --name-only` 获取变更文件列表
2. Agent 逐文件阅读改动，生成 Review 报告
3. 报告格式：问题列表（严重程度 + 建议）+ 验证结果（typecheck / test / build）

#### 决策矩阵

| 最高严重程度 | 决策 |
|-------------|------|
| CRITICAL/HIGH | **必须修复**，修复后重新 Review |
| MEDIUM | **建议修复**，可带修复提交后打 Tag |
| LOW | **可选**，可记录到 TODO 后打 Tag |

### 步骤 6：验证

```bash
git log --oneline -10
```

## 安全限制

- **禁止自动 push**：压缩改写历史，必须人工确认后才能 `git push --force`
- **备份分支必须保留**：直到确认压缩结果无误后才可删除
- **reset 只用 --soft**：保留所有改动在暂存区，绝不使用 --hard
- **push 需显式指令**：完成压缩后提示用户手动执行 push

## 回滚方法

如果压缩结果有问题，可从备份分支恢复：

```bash
git reset --hard backup/squash-<日期>
```

确认无误后删除备份分支：

```bash
git branch -D backup/squash-<日期>
```

## 真实案例：Prism 去后端重构（2026-07-13）

### 背景

将"分析改前端直连 + 删除后端"重构的 14 个小步提交压缩为少量语义化提交。

### 压缩前（14 个提交）

```
c78d08b refactor(prototype): index.html 分析逻辑改为前端直连
0d94d4e docs(readme): 删除后端相关说明
d0b0927 docs(context): 更新分析链路说明
ad9cc41 docs(agents): 更新为纯前端架构
cf6ece2 chore(makefile): 简化 verify 移除后端步骤
50f3e98 ci: 移除后端 CI 测试任务
d4af13e refactor(backend): 删除整个后端服务
1ffd0bf ci(hooks): pre-commit 移除后端测试步骤
23e5b12 refactor(config): 删除分析端点环境变量
cdd6ace refactor(analyzer): 删除旧 streamAnalysis 和 fetchAnalysis
eebb26d refactor(context): 分析链路切换至 directStreamAnalysis
f888ba2 feat(analyzer): 实现 directStreamAnalysis 直连模型 API
7a86bd3 feat(analyzer): 迁移 parseLabelJson 和 buildAnalyzerPrompt
0447464 ci(hooks): 纳入版本控制并支持 scope 格式
```

### 操作

1. `git branch backup/squash-20260713`
2. `git reset --soft accbb80`（accbb80 = 0447464 的父提交）
3. 按功能模块分组提交（见下）

### 压缩后

按核心实现 / 配置清理 / 文档 三组拆分。
