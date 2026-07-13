.PHONY: verify test-frontend typecheck-frontend build-frontend dev-frontend

# 一键质量门禁（推荐提交前运行）
verify: test-frontend typecheck-frontend build-frontend
	@echo "✔ 验证通过"

# 前端测试
test-frontend:
	cd frontend && npm run test:run

# 前端类型检查（TS 严格模式）
typecheck-frontend:
	cd frontend && npm run typecheck

# 前端构建（含于 verify 质量门禁）
build-frontend:
	cd frontend && npm run build

# 前端开发服务器
dev-frontend:
	cd frontend && npm run dev
