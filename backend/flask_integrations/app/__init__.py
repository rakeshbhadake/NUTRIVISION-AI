import os
from pathlib import Path

from flask import Flask, jsonify
from dotenv import dotenv_values
from werkzeug.exceptions import HTTPException


def create_app(test_config=None):
    module_path = Path(__file__).resolve()
    # Explicit process environment wins, then service-local .env, then root .env.
    # Paths are independent of the shell's current working directory.
    env = {**dotenv_values(module_path.parents[3] / ".env"), **dotenv_values(module_path.parents[1] / ".env"), **os.environ}
    app = Flask(__name__)
    app.config.from_mapping(
        INTERNAL_SERVICE_TOKEN=env.get("INTERNAL_SERVICE_TOKEN") or "",
        WEBHOOK_SIGNING_SECRET=env.get("WEBHOOK_SIGNING_SECRET") or "",
        WEBHOOK_DATABASE_PATH=env.get("WEBHOOK_DATABASE_PATH") or "./data/webhooks.sqlite3",
        OPENFOODFACTS_USER_AGENT=env.get("OPENFOODFACTS_USER_AGENT") or "NutriVisionAI/1.0 (self-hosted nutrition tracker)",
        MAX_CONTENT_LENGTH=1024 * 1024,
    )
    if test_config:
        app.config.update(test_config)
    from app.integrations.barcode import blueprint as barcode
    from app.webhooks.routes import blueprint as webhooks
    app.register_blueprint(barcode)
    app.register_blueprint(webhooks)

    @app.get("/integrations/health")
    def health():
        return jsonify(status="ok", service="nutrivision-integrations")

    @app.after_request
    def secure_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(detail=error.description), error.code

    return app
