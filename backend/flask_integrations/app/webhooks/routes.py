import hashlib
import hmac
import time

from flask import Blueprint, current_app, jsonify, request

from app.security import internal_only
from app.webhooks.ledger import connect, record_event

blueprint = Blueprint("webhooks", __name__)


def receive_event(channel):
    secret = current_app.config["WEBHOOK_SIGNING_SECRET"]
    if not secret:
        return jsonify(detail="Webhook signing is not configured."), 503
    raw_body = request.get_data(cache=True)
    timestamp = request.headers.get("X-NutriVision-Timestamp", "")
    signature = request.headers.get("X-NutriVision-Signature", "")
    try:
        if abs(int(time.time()) - int(timestamp)) > 300:
            return jsonify(detail="Webhook timestamp is outside the five minute window."), 401
    except ValueError:
        return jsonify(detail="A valid webhook timestamp is required."), 401
    expected = hmac.new(secret.encode(), timestamp.encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature.removeprefix("sha256=").encode("utf-8"), expected.encode("ascii")):
        return jsonify(detail="Invalid webhook signature."), 401
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not all(isinstance(body.get(key), str) and 0 < len(body[key]) <= 150 for key in ("provider", "event_id", "event_type")) or not isinstance(body.get("data"), dict):
        return jsonify(detail="Expected provider, event_id, event_type strings and a data object."), 400
    if not record_event(body):
        return jsonify(detail="Duplicate event rejected.", event_id=body["event_id"]), 409
    # A receipt does not imply changes to payments or user data. Provider-specific adapters
    # should consume this durable ledger and call authenticated Django business APIs.
    return jsonify(status="received", channel=channel, event_id=body["event_id"], processed=False), 202


@blueprint.post("/integrations/webhooks/")
def webhook():
    return receive_event("webhook")


@blueprint.post("/integrations/external-callback/")
def external_callback():
    return receive_event("external-callback")


@blueprint.get("/integrations/events/")
@internal_only
def events():
    with connect() as connection:
        rows = connection.execute("SELECT provider, event_id, event_type, received_at FROM integration_events ORDER BY received_at DESC LIMIT 100").fetchall()
    return jsonify(events=[dict(zip(("provider", "event_id", "event_type", "received_at"), row)) for row in rows])
