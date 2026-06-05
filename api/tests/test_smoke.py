"""Phase 0 smoke tests: app boots, health responds, OpenAPI exports the contract,
and stubs return 501 (not 500) so the contract surface is honest."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_openapi_exports_contract() -> None:
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/imports" in paths
    assert "/profiles/{profile_id}/recs/{surface}" in paths
    assert "/profiles/{profile_id}/feedback" in paths


def test_stub_returns_501() -> None:
    # sharing remains a Phase-3 stub; the surface should be honest.
    r = client.get("/share/whatever")
    assert r.status_code == 501
    assert r.json()["detail"]["error"]["code"] == "not_implemented"
