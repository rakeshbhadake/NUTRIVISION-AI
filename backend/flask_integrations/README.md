# NutriVision integrations

This independent Flask service handles barcode lookups and verified integration
receipts. Authentication, profiles, meals, subscriptions, and nutrition business
logic remain in Django. Image recognition remains in FastAPI.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
$env:INTERNAL_SERVICE_TOKEN = "<same random token as Django>"
$env:WEBHOOK_SIGNING_SECRET = "<a different random signing secret>"
$env:WEBHOOK_DATABASE_PATH = "./data/webhooks.sqlite3"
$env:OPENFOODFACTS_USER_AGENT = "NutriVisionAI/1.0 (https://your-app.example/contact)"
.\.venv\Scripts\waitress-serve --port=8002 --call app:create_app
```

Configuration automatically loads the repository root `.env`, then the service
local `.env`. Explicit process environment variables take precedence. File lookup
does not depend on the current working directory.

Docker uses Gunicorn and a writable `/data` volume. SQLite stores only the
integration receipt/replay ledger. Django's PostgreSQL remains the primary
application database. For horizontally scaled integration instances, replace the
ledger with a shared durable queue/database and preserve the unique event key.

## Endpoints

- `GET /integrations/health`: public liveness.
- `POST /integrations/barcode/`: internal bearer authentication, JSON `barcode`
  string and optional `portion_grams` (default 100). Validates EAN/UPC check digits,
  retrieves real [Open Food Facts product data](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/),
  normalizes nutrient units, and returns `item`, `product`, warnings, and attribution.
  Incomplete macro labels return 422 rather than inventing values. Unknown products
  return 404. Source data are community-maintained and should be checked on the pack.
- `POST /integrations/webhooks/` and `/integrations/external-callback/`: authenticated
  with the signature scheme below. Valid events are durably recorded and return
  HTTP 202 with `processed: false`. This is an adapter ingestion boundary; it does
  not pretend to update subscriptions or connect a wearable. Add a provider-specific
  adapter/consumer to call Django business APIs after verifying its provider contract.
- `GET /integrations/events/`: internal bearer authentication; latest 100 receipt
  metadata records, excluding payloads.

## Webhook signature

Body: `{ "provider": "your-adapter", "event_id": "unique-id", "event_type":
"wearable.sync", "data": {} }`.

Set `X-NutriVision-Timestamp` to Unix seconds and `X-NutriVision-Signature` to
`sha256=<hex HMAC-SHA256 of timestamp + "." + exact raw JSON body>`, signed with
`WEBHOOK_SIGNING_SECRET`. Timestamps must be within five minutes. `(provider,
event_id)` is unique across restarts; repeated events return 409. Use a provider
adapter when the external service has its own signature format, such as Stripe.
Unsigned arbitrary payment callbacks are never trusted.

The default User-Agent should be customized with the deployment contact URL.
Attribute Open Food Facts contributors and comply with ODbL database reuse terms.
See [Open Food Facts API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/).

## Verify

```powershell
.\.venv\Scripts\python -m pytest -q
```

Tests isolate external HTTP calls and cover authentication, barcode validation,
label mapping and missing nutrients, signature checks, expiry, and durable replay
rejection. A live lookup additionally requires outbound Internet connectivity.
