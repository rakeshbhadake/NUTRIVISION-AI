import logging
from rest_framework.views import exception_handler as drf_handler

logger = logging.getLogger(__name__)

def exception_handler(exc, context):
    response = drf_handler(exc, context)
    if response is not None:
        return response
    logger.exception("Unhandled API exception", exc_info=exc)
    from rest_framework.response import Response
    return Response({"detail": "An unexpected error occurred. Please retry."}, status=500)
