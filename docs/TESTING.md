# Verification

Verified locally on November 10, 2026 with Python 3.12, Node.js 22 and the explicit SQLite development backend. Tests use isolated databases/fixtures; production code does not contain mock detections.

| Suite | Result | Meaningful coverage |
| --- | --- | --- |
| Django | 25 passed | Authentication/cookie-endpoint CSRF/rotation/revocation, untrusted-origin rejection, verification/reset, profile, meal portions/nullable nutrients, database constraints, owner isolation, staff permissions, real proxy boundary validation, exports, analytics and WebSocket isolation, cache privacy |
| FastAPI | 19 passed | Internal auth, invalid/large/mismatched images, structured provider schemas, proxy-shaped requests, unknown foods, source labeling, nutrient scaling and upstream failures |
| Flask | 11 passed | Internal auth, barcode digits/checksums, real label normalization contract, missing nutrients, HMAC validation/expiry and persistent replay rejection |
| React | 9 passed | Auth input validation and CSRF transport, goal numeric payload/range validation, portion correction/save, catalog gram-basis conversion, local date handling, preservation of unknown nutrition/provenance |
| Production build | Passed | Vite bundles JavaScript/JSX with route-level lazy loading |
| Django consistency | Passed | System checks, migration consistency, development migrations applied, admin static assets collected |
| HTTP integration | Passed | Running Django → FastAPI/Flask bridges, auth through reports, genuine barcode call, honest AI key errors |
| Dependency audit | Passed | `npm audit --omit=dev --audit-level=high`: zero known production vulnerabilities at the time of validation |

Run from each service directory:

```powershell
# backend/django_api
$env:USE_SQLITE='true'
$env:DJANGO_DEBUG='true'
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run

# backend/fastapi_ai
.\.venv\Scripts\python.exe -m pytest -q

# backend/flask_integrations
.\.venv\Scripts\python.exe -m pytest -q

# frontend
npm test
npm run build
```

The Flask suite was run using the AI service's virtualenv during development because it had both services' dependencies installed; the setup launcher creates independent environments on a fresh checkout.

## Real HTTP smoke test

Start all services, then from the project root:

```powershell
backend\django_api\.venv\Scripts\python.exe infrastructure\smoke_test.py
```

The script is restricted to loopback URLs. It creates unique synthetic `.invalid` accounts, exercises real HTTP signup/login/CSRF refresh, profile privacy, meals and portion math, daily summaries, search/history/analytics/goals/water, reports, staff denial, real barcode lookup, and explicit provider configuration failures. It deletes only exact accounts it generated, including their own QA records, and refuses remote database cleanup. The ignored report is `artifacts/smoke-results.json`.

When `OPENAI_API_KEY` is absent, its AI checks intentionally require a clear 503; this proves configuration/error handling, not model inference. Once a key is present, verify real food recognition manually in the UI with a permitted test photograph. Network mocks are limited to automated test boundaries and are not production fallbacks.

## Browser checks performed

- Opened the landing/login flow and authenticated a disposable local QA account.
- Confirmed an empty dashboard reads zero records with editable starting goals.
- Entered a synthetic food label at 100 g, changed to 200 g, and saved. The daily tracker showed 360 kcal, 18 g protein, 40 g carbs and 14 g fat.
- Edited that saved portion to 150 g; the dashboard updated to 270 kcal with a record-backed meal timeline and streak.
- Reloaded and verified the HttpOnly-cookie refresh restored the session.
- Checked desktop (1440 px) and mobile (390 px) layouts; the mobile view had no horizontal document overflow. Confirmed closed mobile navigation is inert.
- Checked English/Hindi settings and light/dark appearance. No camera, microphone or browser notification permission was granted during QA.
- The synthetic browser account and its records are removed after QA; no demo nutrition records are shipped.

## Live external calls and unverified infrastructure

Genuine Open Food Facts barcode `3017620422003` and USDA FoodData Central cooked rice composition lookup returned successfully. Provider-specific food data are not seeded as app records.

No OpenAI key was available, so **live vision accuracy/inference is unverified**. No real OAuth account, SMTP server, Supabase PostgreSQL, S3 storage, managed Redis or cloud deployment was configured. Docker is absent, so the Compose stack was not executed. PostgreSQL deployment smoke checks remain necessary; SQLite tests do not establish PostgreSQL concurrency behavior.

Known build output: Zod includes removable Rollup annotation warnings; the production build succeeds. Route splitting keeps emitted JavaScript chunks under Vite's default warning threshold in the verified build. The browser's development HMR log contained transient reload errors while multiple files were being formatted; a clean reload restored the session and the verified pages operated correctly.
