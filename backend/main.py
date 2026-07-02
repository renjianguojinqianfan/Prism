# 棱镜 (Prism) 后端入口：re-export app 供 `uvicorn main:app` 使用；
# app 实例定义在 app.main:app，`python main.py` 亦走该路径启动（带 reload）。
# 启动：cd backend && uvicorn main:app --reload --port 8000
import os

import uvicorn
from app.main import app  # noqa: F401  供 uvicorn main:app 加载

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PRISM_PORT", "8000")),
        reload=True,
    )
