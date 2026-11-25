import functools
import hmac

from flask import current_app, jsonify, request


def internal_only(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        expected = current_app.config["INTERNAL_SERVICE_TOKEN"]
        if not expected:
            return jsonify(detail="Set INTERNAL_SERVICE_TOKEN before enabling integrations."), 503
        authorization = request.headers.get("Authorization", "")
        token = authorization[7:] if authorization.startswith("Bearer ") else ""
        if not hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8")):
            return jsonify(detail="Invalid internal service credentials."), 401
        return view(*args, **kwargs)
    return wrapped
