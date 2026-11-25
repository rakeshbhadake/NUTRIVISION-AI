import base64
import io
import warnings

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings

Image.MAX_IMAGE_PIXELS = 20_000_000
ALLOWED = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


async def prepare_image(image: UploadFile) -> str:
    """Decode trusted pixels, discard EXIF/location data, and bound inference cost."""
    if image.content_type not in ALLOWED:
        raise HTTPException(415, "Use a JPEG, PNG, or WebP food photograph.")
    content = await image.read(settings().max_image_bytes + 1)
    if not content:
        raise HTTPException(400, "The image file is empty.")
    if len(content) > settings().max_image_bytes:
        raise HTTPException(413, "Image exceeds the configured 8 MB upload limit.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as original:
                if original.format != ALLOWED[image.content_type]:
                    raise HTTPException(415, "Image contents do not match its MIME type.")
                original.load()
                converted = ImageOps.exif_transpose(original).convert("RGB")
                converted.thumbnail((1600, 1600))
                output = io.BytesIO()
                converted.save(output, format="JPEG", quality=88)
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(400, "The image is invalid or its pixel dimensions are too large.") from None
    return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")
