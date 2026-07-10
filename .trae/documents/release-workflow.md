# Prism 发版流程

> 每次发版时按此流程执行，确保不遗漏关键步骤。

## 1. 确认代码状态

```bash
# 确认 main 分支最新且干净
git checkout main
git pull prism main
git status   # 应无未提交改动

# 确认所有测试通过
make verify
```

**通过标准**：82 前端测试 + 63 后端测试 + typecheck + build 全绿。

## 2. 检查文档准确性

参照 [release-doc-checklist.md](./release-doc-checklist.md) 逐项检查。

## 3. 端到端测试

参照 [release-e2e-test.md](./release-e2e-test.md) 启动服务并用 Playwright 验证核心功能。

## 4. 填写发版检查记录

参照 [release-checklist-record.md](./release-checklist-record.md) 逐项确认并记录结果。

## 5. 生成 Release Notes

```bash
# 查看自上次 tag 以来的改动（首次 release 看全部）
git tag -l                          # 查看现有 tag
git log --oneline <last-tag>..HEAD  # 查看新 commit
```

整理为结构化 release notes，包含：
- 版本号与发布日期
- 功能特性
- 安全加固
- 依赖升级
- 已知问题
- 质量状态

## 6. 创建 Tag 并推送

```bash
git tag v0.1.0
git push prism v0.1.0
```

## 7. 创建 GitHub Release

```bash
# 用 release notes 内容创建 release（需 keyring token 有 repo scope）
$env:GH_TOKEN = $null; $env:GITHUB_TOKEN = $null
gh release create v0.1.0 --repo renjianguojinqianfan/Prism \
  --title "v0.1.0" \
  --notes-file .trae/documents/release-notes-v0.1.0.md
```

## 8. 验证 Release

- GitHub 仓库主页可见 Release
- Tag 指向正确的 commit
- Release notes 内容完整

## 回滚

如果发版后发现严重问题：

```bash
# 方案 1：revert 相关 commit
git revert <commit-hash> --no-edit
git push prism main

# 方案 2：紧急回滚（直接改回旧版本号）
# 编辑 requirements.txt / package.json 改回旧版本
make verify
git add -A && git commit -m "revert: 回滚至 <版本>"
git push prism main
```

注意：禁止 `git reset --hard` + `force push` 到 main。
