"""Exercise the running local services through real HTTP and clean synthetic records.

Run with the Django virtualenv Python. Never point this at a remote service.
Provider-free AI checks deliberately assert an honest 503, rather than fake inference.
"""
import argparse
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse
import uuid

import httpx
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DJANGO_DIR = ROOT / "backend" / "django_api"
ARTIFACTS = ROOT / "artifacts"
UI_CREDENTIALS = ARTIFACTS / "ui-credentials.json"


def local_url(value):
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise argparse.ArgumentTypeError("Smoke tests are restricted to loopback HTTP(S) URLs.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise argparse.ArgumentTypeError("Use a plain local base URL without credentials or query parameters.")
    return value.rstrip("/")


def check(response, expected, label):
    if response.status_code != expected:
        try: detail = response.json()
        except ValueError: detail = response.text[:400]
        raise AssertionError(f"{label}: expected HTTP {expected}, received {response.status_code}: {detail}")
    return response


def synthetic_credentials(purpose):
    run_id = uuid.uuid4().hex
    return {"email": f"nv-{purpose}-{run_id}@example.invalid", "password": secrets.token_urlsafe(28), "full_name": "Browser QA" if purpose == "ui" else "Integration QA", "purpose": purpose, "run_id": run_id}


def csrf_headers(client):
    csrf = check(client.get("/api/auth/csrf/"), 200, "csrf token").json()["csrfToken"]
    return {"X-CSRFToken": csrf}


def register(client, values):
    response = check(client.post("/api/auth/register/", json={k: values[k] for k in ["email", "password", "full_name"]}, headers=csrf_headers(client)), 201, "register")
    if "access" not in response.json():
        raise AssertionError("Local smoke testing needs REQUIRE_EMAIL_VERIFICATION=false; a verification email was required.")
    client.headers["Authorization"] = "Bearer " + response.json()["access"]
    return response.json()


def cleanup(emails):
    """Delete only exact generated identities, using this checkout's configured local DB."""
    if not emails: return
    script = r'''
import json, os, re, sys
from pathlib import Path
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from meals.models import AIAnalysisLog
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
emails = json.load(sys.stdin)
pattern = r"nv-(?:smoke|ui)-[0-9a-f]{32}@example\.invalid"
if not all(isinstance(e, str) and re.fullmatch(pattern, e) for e in emails):
    raise SystemExit("Refusing to delete an identity outside the generated QA namespace.")
database = settings.DATABASES["default"]
if database["ENGINE"].endswith("sqlite3"):
    db_path = Path(database["NAME"]).resolve()
    if not db_path.is_relative_to(Path.cwd().resolve()):
        raise SystemExit("Refusing cleanup outside this checkout's local SQLite database.")
elif database.get("HOST", "") not in {"localhost", "127.0.0.1", "::1"}:
    raise SystemExit("Refusing cleanup on a remote PostgreSQL database.")
with transaction.atomic():
    users = get_user_model().objects.filter(email__in=emails)
    ids = list(users.values_list("pk", flat=True))
    AIAnalysisLog.objects.filter(user_id__in=ids).delete()
    OutstandingToken.objects.filter(user_id__in=ids).delete()
    users.delete()
print(json.dumps({"cleaned_accounts": len(ids)}))
'''
    result = subprocess.run([sys.executable, "-c", script], input=json.dumps(emails), text=True, cwd=DJANGO_DIR, capture_output=True, env=os.environ.copy(), timeout=30)
    if result.returncode:
        raise RuntimeError("Synthetic account cleanup failed: " + (result.stderr or result.stdout)[-1200:])
    return json.loads(result.stdout.strip())


def run_smoke(base_url, keep=False):
    identities = []
    completed = []
    clients = []
    try:
        client = httpx.Client(base_url=base_url, timeout=110)
        other = httpx.Client(base_url=base_url, timeout=110)
        clients.extend([client, other])
        check(client.get("/health/"), 200, "health")
        primary, secondary = synthetic_credentials("smoke"), synthetic_credentials("smoke")
        identities.extend([primary, secondary])
        session = register(client, primary)
        register(other, secondary)
        completed.append("signup and private profiles")
        login = check(client.post("/api/auth/login/", json={"email": primary["email"], "password": primary["password"]}, headers=csrf_headers(client)), 200, "login")
        client.headers["Authorization"] = "Bearer " + login.json()["access"]
        csrf = check(client.get("/api/auth/csrf/"), 200, "csrf").json()["csrfToken"]
        check(client.post("/api/auth/refresh/", json={}), 403, "refresh requires CSRF")
        refreshed = check(client.post("/api/auth/refresh/", json={}, headers={"X-CSRFToken": csrf}), 200, "refresh rotation")
        client.headers["Authorization"] = "Bearer " + refreshed.json()["access"]
        completed.append("login, CSRF and HttpOnly refresh rotation")
        now = datetime.now(timezone.utc).isoformat()
        payload = {"name": "Synthetic smoke meal", "meal_type": "lunch", "eaten_at": now, "items": [{"name": "Test nutrient record", "portion_g": 100, "calories": 120, "protein": 8, "carbohydrates": 16, "fat": 3, "fiber": None, "sugar": None, "sodium": None, "source": "Synthetic integration test", "is_estimate": True}]}
        meal = check(client.post("/api/meals/", json=payload), 201, "create meal").json()
        meal_id, item_id = meal["id"], meal["items"][0]["id"]
        updated = check(client.patch(f"/api/meals/{meal_id}/", json={"items": [{"id": item_id, "portion_g": 200}]}), 200, "portion adjustment").json()
        assert updated["totals"]["calories"] == 240 and updated["totals"]["protein"] == 16
        assert set(updated["unknown_nutrients"]) == {"fiber", "sugar", "sodium"}
        daily = check(client.get("/api/nutrition/daily/"), 200, "daily nutrition").json()
        assert daily["totals"]["calories"] == 240 and daily["meals"][0]["id"] == meal_id
        history = check(client.get("/api/meals/", params={"search": "Synthetic smoke"}), 200, "meal history").json()
        assert history["count"] == 1
        analytics = check(client.get("/api/analytics/", params={"period": "week"}), 200, "weekly analytics").json()
        assert len(analytics["days"]) == 7 and analytics["totals"]["calories"] == 240
        month = check(client.get("/api/nutrition/monthly/"), 200, "monthly nutrition").json()
        assert len(month["days"]) == 30
        completed.append("meal save, portion recalculation, daily totals, history and analytics")
        goal = check(client.put("/api/goals/", json={"calories": 2200, "water_ml": 2750}), 200, "goal update").json()
        assert goal["calories"] == 2200
        water = check(client.post("/api/water/", json={"amount_ml": 250}), 201, "water log").json()
        assert check(client.get("/api/nutrition/daily/"), 200, "updated dashboard").json()["water_ml"] == 250
        assert check(client.get("/api/achievements/"), 200, "earned badges").json()["results"]
        for fmt in ["csv", "pdf"]:
            report = check(client.get("/api/reports/export/", params={"format": fmt}), 200, f"{fmt} export")
            assert report.content.startswith(b"%PDF") if fmt == "pdf" else b"Test nutrient record" in report.content
        completed.append("goals, water, earned badges and CSV/PDF downloads")
        check(other.get(f"/api/meals/{meal_id}/"), 404, "meal owner isolation")
        check(other.patch(f"/api/meals/{meal_id}/", json={"name": "Unauthorized"}), 404, "meal update isolation")
        check(other.delete(f"/api/water/{water['id']}/"), 404, "water owner isolation")
        assert check(other.get("/api/nutrition/daily/"), 200, "other account summary").json()["totals"]["calories"] == 0
        check(client.get("/api/admin/summary/"), 403, "staff authorization")
        completed.append("cross-user privacy and staff authorization")
        barcode = check(client.post("/api/integrations/barcode/", json={"barcode": "3017620422003", "portion_grams": 100}), 200, "live barcode lookup").json()
        assert barcode["item"]["name"] and barcode["item"]["nutrition"]["calories"] > 0
        assert "Open Food Facts" in barcode["item"]["source"]
        completed.append("live Flask/Open Food Facts barcode integration")
        image = io.BytesIO()
        Image.new("RGB", (16, 16), "green").save(image, format="PNG")
        image_response = check(client.post("/api/ai/recognize/", files={"image": ("test.png", image.getvalue(), "image/png")}), 503, "unconfigured real AI image provider")
        assert "OPENAI_API_KEY" in str(image_response.json())
        assistant = check(client.post("/api/ai/assistant/", json={"message": "How can I plan a balanced lunch?", "history": []}), 503, "unconfigured real AI assistant")
        assert "OPENAI_API_KEY" in str(assistant.json())
        completed.append("real AI proxy schemas and explicit missing-provider-key errors")
        check(client.delete(f"/api/meals/{meal_id}/"), 204, "delete meal")
        assert check(client.get("/api/nutrition/daily/"), 200, "deleted totals").json()["totals"]["calories"] == 0
        check(client.post("/api/auth/logout/", json={}), 200, "logout")
        check(client.get("/api/users/profile/"), 401, "logout revocation")
        completed.append("delete recalculation and logout session revocation")
        result = {"status": "passed", "checks": completed, "live_inference": "not executed: OPENAI_API_KEY absent", "database": "running local configured database"}
        if keep:
            ARTIFACTS.mkdir(exist_ok=True)
            path = ARTIFACTS / f"smoke-credentials-{primary['run_id']}.json"
            path.write_text(json.dumps({"base_url": base_url, "accounts": identities}, indent=2), encoding="utf-8")
            result["kept_credentials_file"] = str(path)
        return result
    finally:
        for client in clients: client.close()
        if not keep:
            cleanup([identity["email"] for identity in identities])


def create_ui_account(base_url):
    if UI_CREDENTIALS.exists():
        raise RuntimeError("An existing UI QA credentials file exists. Run --cleanup-ui-account before creating another.")
    values = synthetic_credentials("ui")
    with httpx.Client(base_url=base_url, timeout=30) as client:
        register(client, values)
    ARTIFACTS.mkdir(exist_ok=True)
    UI_CREDENTIALS.write_text(json.dumps({"base_url": base_url, **values}, indent=2), encoding="utf-8")
    return {"status": "created", "credentials_file": str(UI_CREDENTIALS), "email": values["email"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", type=local_url, default="http://127.0.0.1:8000")
    parser.add_argument("--keep", action="store_true", help="Keep only this run's generated smoke accounts; credentials go in ignored artifacts.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--create-ui-account", action="store_true")
    mode.add_argument("--cleanup-ui-account", action="store_true")
    args = parser.parse_args()
    if args.cleanup_ui_account:
        values = json.loads(UI_CREDENTIALS.read_text(encoding="utf-8"))
        if values.get("purpose") != "ui": raise RuntimeError("Refusing to clean an unrecognized credentials artifact.")
        result = cleanup([values["email"]])
        UI_CREDENTIALS.unlink()
    elif args.create_ui_account:
        result = create_ui_account(args.base_url)
    else:
        result = run_smoke(args.base_url, args.keep)
        ARTIFACTS.mkdir(exist_ok=True)
        (ARTIFACTS / "smoke-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
