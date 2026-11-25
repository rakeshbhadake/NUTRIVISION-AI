from django.utils.cache import patch_vary_headers


class PrivateAPICacheMiddleware:
    """Keep API records and auth errors out of browser/shared HTTP caches."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path == "/api" or request.path.startswith("/api/"):
            response["Cache-Control"] = "private, no-store, max-age=0"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"
            patch_vary_headers(response, ["Authorization", "Cookie"])
        return response
