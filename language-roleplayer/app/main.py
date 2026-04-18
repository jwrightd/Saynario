"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import get_settings
from app.routes import scenarios, sessions, users, websocket
from app.services.scenario_loader import load_scenarios

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
SCENARIOS_DIR = BASE_DIR / "scenarios"
FRONTEND_BUILD_DIR = BASE_DIR / "frontend" / "build"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    settings = get_settings()
    logger.info(f"Starting Saynario (mock_mode={settings.mock_mode})")

    # Load scenarios
    load_scenarios(str(SCENARIOS_DIR))

    yield

    logger.info("Shutting down...")


app = FastAPI(
    title="Saynario",
    description="Voice-to-voice AI agent for language learning through roleplay scenarios",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(scenarios.router)
app.include_router(sessions.router)
app.include_router(users.router)
app.include_router(websocket.router)


# Health check
@app.get("/api/health")
async def health_check():
    settings = get_settings()
    return {
        "status": "ok",
        "mock_mode": settings.mock_mode,
        "version": "1.0.0",
    }


def mount_frontend(app: FastAPI, frontend_build: Path) -> None:
    """Mount a built frontend when its build output is available."""
    if not frontend_build.is_dir():
        logger.info("Frontend build directory not found at %s; skipping frontend mount", frontend_build)
        return

    index_file = frontend_build / "index.html"
    if not index_file.is_file():
        logger.warning(
            "Frontend build directory exists at %s but index.html is missing; skipping frontend mount",
            frontend_build,
        )
        return

    mounted_asset_dirs = []
    for asset_dir_name in ("assets", "static"):
        asset_dir = frontend_build / asset_dir_name
        if asset_dir.is_dir():
            app.mount(f"/{asset_dir_name}", StaticFiles(directory=asset_dir), name=asset_dir_name)
            mounted_asset_dirs.append(asset_dir_name)

    if not mounted_asset_dirs:
        logger.warning(
            "Frontend build directory exists at %s but no asset directories were found",
            frontend_build,
        )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        """Serve the built frontend for all non-API routes."""
        file_path = frontend_build / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(index_file)


mount_frontend(app, FRONTEND_BUILD_DIR)
