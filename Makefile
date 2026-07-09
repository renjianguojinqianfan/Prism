.PHONY: verify test-frontend typecheck-frontend test-backend build-frontend dev-frontend dev-backend

# 一键质量门禁（推荐提交前运行）
verify: test-frontend typecheck-frontend test-backend
	@echo "✔ 验证通过"

# 前端测试
test-frontend:
	cd frontend && npm run test:run

# 前端类型检查（TS 严格模式）
typecheck-frontend:
	cd frontend && npm run typecheck

# 前端构建（可选，发布前运行）
build-frontend:
	cd frontend && npm run build

# 后端测试
test-backend:
	cd backend && pytest

# 前端开发服务器
dev-frontend:
	cd frontend && npm run dev

# 后端开发服务器
dev-backend:
	cd backend && uvicorn main:app --reload --port 8000
