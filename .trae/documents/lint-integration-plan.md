# Prism Lint 集成方案

> 状态:待实施(CI 稳定后启动)
> 创建时间:2026-07-09
> 目标:为前端引入 ESLint,为后端引入 Ruff,并接入 CI 自动检查

---

## 一、前端 ESLint

### 1.1 安装依赖(devDependencies,不影响 bundle)

```bash
cd frontend
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks
```

### 1.2 新增配置文件 `frontend/eslint.config.js`

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
);
```

### 1.3 `package.json` 添加 script

```json
"lint": "eslint ."
```

---

## 二、后端 Ruff

### 2.1 安装依赖

```bash
cd backend
pip install ruff
```

并在 `backend/requirements-dev.txt` 追加:

```
ruff>=0.6
```

### 2.2 新增配置文件 `backend/ruff.toml`

```toml
target-version = "py311"
line-length = 100

[lint]
select = ["E", "F", "I", "W", "UP"]
ignore = ["E501"]

[lint.per-file-ignores]
"tests/*" = ["F401"]
```

---

## 三、CI 配置修改

在 `.github/workflows/ci.yml` 的两个 job 中各加一步。

### 3.1 frontend job — 在 typecheck 前加

```yaml
      - name: Lint
        run: npm run lint
        working-directory: frontend
```

### 3.2 backend job — 在 pytest 前加

```yaml
      - name: Lint
        run: ruff check .
        working-directory: backend
```

---

## 四、本地运行

```bash
# 前端
cd frontend && npm run lint

# 后端
cd backend && ruff check .
```

### 4.1 Makefile 扩展(可选)

```makefile
lint-frontend:
	cd frontend && npm run lint

lint-backend:
	cd backend && ruff check .

# 扩展 verify 目标
verify: lint-frontend lint-backend test-frontend typecheck-frontend test-backend
```

---

## 五、注意事项

1. **AGENTS.md 规则**:当前规则禁止"在前端引入除 marked 之外的大型依赖"。ESLint 属于 devDependencies(开发工具,不进生产 bundle),通常不在该限制范畴。实施前建议在 AGENTS.md 第 4 章"禁止事项"中明确豁免 devDependencies,避免歧义。

2. **渐进式接入**:首次启用 ESLint/Ruff 可能报大量历史告警。建议:
   - 先用 `ruff check --fix` 自动修复可修复项
   - ESLint 先以 warning 级别报告,逐步收紧为 error
   - 或用 `--max-warnings` 设阈值,逐步降低

3. **TypeScript 严格模式**:项目已开 `strict` + `noUnusedLocals` + `noUnusedParameters`,ESLint 的 `typescript-eslint` recommended 规则与之互补,不会重复报错。

4. **版本参考**(创建时点):
   - ESLint 9+(flat config 格式)
   - typescript-eslint 8+
   - eslint-plugin-react 7.35+
   - eslint-plugin-react-hooks 5+
   - Ruff 0.6+

---

## 六、实施清单(启动时勾选)

- [ ] 确认 CI 已稳定运行
- [ ] AGENTS.md 补充 devDependencies 豁免说明
- [ ] 前端:安装 ESLint 依赖
- [ ] 前端:新增 eslint.config.js
- [ ] 前端:package.json 添加 lint script
- [ ] 后端:安装 Ruff 并更新 requirements-dev.txt
- [ ] 后端:新增 ruff.toml
- [ ] CI:两个 job 各加 Lint 步骤
- [ ] Makefile:扩展 verify 目标(可选)
- [ ] 本地运行验证通过
- [ ] 提交并推送
