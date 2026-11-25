# NutriVision AI service

This independent FastAPI service accepts authenticated calls from Django. It calls
the real OpenAI Responses API with image input and a strict, validated JSON schema.
It never substitutes sample detections when a provider is unavailable. It optionally
matches foods against USDA FoodData Central to replace estimated nutrient values
with traceable composition records. Portion sizes remain estimates.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
$env:INTERNAL_SERVICE_TOKEN = "<same random token as Django>"
$env:OPENAI_API_KEY = "<server-side key>"
$env:OPENAI_MODEL = "gpt-4o-mini"
$env:USDA_API_KEY = "<FoodData Central data.gov key>"
.\.venv\Scripts\python -m uvicorn app.main:app --port 8001
```

Configuration automatically loads the repository root `.env`, then the service
local `.env`. Explicit process environment variables take precedence. File lookup
does not depend on the current working directory.

Alternatively use the repository Docker Compose configuration. Do not publish this
service directly to the browser. `INTERNAL_SERVICE_TOKEN` is mandatory; an unset
token denies all AI operations. `GET /health` is public and reports liveness only.
An unset OpenAI key returns a 503 with setup instructions. Set an available
vision-capable, Structured Outputs-compatible model via `OPENAI_MODEL`.

## Contracts

All `/ai/*` endpoints require `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>`.

- `POST /ai/recognize-food` and `/ai/analyze-meal`: multipart `image`, optional
  `context`. JPEG, PNG, or WebP, up to 8 MB and 20 megapixels. Content is decoded,
  MIME checked, resized, and re-encoded without EXIF before transmission.
- `POST /ai/estimate-nutrition`: `{ "query": "dal and rice", "portion_grams": 300 }`.
- `POST /ai/recommend-food` and `/ai/recommend-recipe`: `{ "query": "...",
  "preferences": [], "allergies": [], "context": {} }`.
- `POST /ai/nutrition-assistant`: `{ "message": "...", "history": [], "context": {} }`.

Food analysis returns `items`, `totals`, `warnings`, `model`, `estimated`, and
`disclaimer`. Each item contains its name, `portion_grams`, `nutrition_per_100g`,
portion `nutrition`, source name/ID/URL, `is_estimate`, and nullable `confidence`.
Nutrient keys: `calories` (kcal), `protein`, `carbs`, `fat`, `fiber`, `sugar` (g),
and `sodium` (mg). Unknown secondary nutrients remain `null`; they are never
silently represented as measured zero. No confidence score is fabricated.

FoodData Central matching uses non-branded food descriptions and a lexical overlap
threshold. A match is an approximate composition substitute and must be reviewed,
especially for mixed dishes. Unmatched foods and unavailable USDA access retain
explicitly labeled AI estimates. No production prediction is hardcoded.

OpenAI requests use `store: false`. Images are not written to disk by this service.
Consult the provider's data policies before deploying. The root application provides
the user-facing estimate review and save step.

## Verify

```powershell
.\.venv\Scripts\python -m pytest -q
```

Tests mock network boundaries to validate authentication, invalid/oversize images,
schema failures, unknown-food handling, portion arithmetic, and source labeling.
They do not claim to evaluate real model accuracy. A live model call requires
your configured provider credentials and quota.

Implementation references: [OpenAI images and vision](https://developers.openai.com/api/docs/guides/images-vision),
[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[USDA API guide](https://fdc.nal.usda.gov/api-guide/).
