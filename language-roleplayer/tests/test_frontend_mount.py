"""Tests for production frontend mounting."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import mount_frontend


def test_mount_frontend_serves_vite_assets(tmp_path):
    """Vite builds should be served from /assets without crashing startup."""
    frontend_build = tmp_path / "frontend" / "build"
    assets_dir = frontend_build / "assets"
    assets_dir.mkdir(parents=True)

    index_file = frontend_build / "index.html"
    index_file.write_text("<html><body>frontend</body></html>", encoding="utf-8")
    (assets_dir / "app.js").write_text("console.log('ok');", encoding="utf-8")

    app = FastAPI()
    mount_frontend(app, frontend_build)
    client = TestClient(app)

    asset_response = client.get("/assets/app.js")
    assert asset_response.status_code == 200
    assert "console.log('ok');" in asset_response.text

    route_response = client.get("/dashboard")
    assert route_response.status_code == 200
    assert "frontend" in route_response.text
