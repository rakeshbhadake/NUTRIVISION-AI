# NutriVision main API

Django owns all application records and authorization. The frontend calls this service, which calls the independent AI and integration services using `INTERNAL_SERVICE_TOKEN`. Every `/api/` response, including authentication failures and downloads, carries `Cache-Control: private, no-store, max-age=0` and varies on `Authorization` and `Cookie` so browsers and shared HTTP caches cannot retain private records. PostgreSQL is the default database; `USE_SQLITE=true` is an explicit development/testing option.

## Development

From this directory, install `requirements.txt` in a Python 3.12 virtual environment. Set `DJANGO_DEBUG=true`, `DJANGO_SECRET_KEY` (a long random value), and either `DATABASE_URL` or the explicit development-only `USE_SQLITE=true`. Run:

```powershell
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 127.0.0.1:8000
```

`daphne` is installed and registered so `runserver` supports ASGI and Channels. Production startup: `daphne -b 0.0.0.0 -p 8000 config.asgi:application`. Use shared Redis (`REDIS_URL`) for Channels groups and throttling across workers. In-memory channel/cache backends only support a single local worker. Set trusted origins/hosts explicitly and run `manage.py collectstatic --noinput` during deployment. WhiteNoise serves the collected, compressed and fingerprinted Django admin assets through Daphne, including when private media storage uses S3. API cache restrictions do not disable static asset caching. Uploaded meal photos remain private and require the owner-authenticated image endpoint.

## Authentication

- `POST /api/auth/register/`: `{email,password,full_name}`. Creates the user, profile, default editable nutrition goal, and free subscription. Sends email verification. Default development login does not require verification; configure `REQUIRE_EMAIL_VERIFICATION=true` for production.
- `POST /api/auth/login/`: `{email,password}`.
- Both return `{access,user}` and a seven-day HttpOnly refresh cookie (`/api/auth/`, SameSite=Lax, Secure outside DEBUG). First fetch `/api/auth/csrf/`, then include the returned token in `X-CSRFToken` on login, registration, Google, Apple and refresh POST requests. All cookie-issuing endpoints enforce CSRF and trusted origins to prevent login CSRF. Access tokens expire in 15 minutes and remain in browser memory. Serve the frontend and API under one origin (a reverse proxy/rewrite) in deployment.
- `GET /api/auth/csrf/` returns `{csrfToken}` and a CSRF cookie. `POST /api/auth/refresh/` requires that token in `X-CSRFToken` and refresh cookie credentials. Refresh rotates and blacklists the previous refresh token. Response is `{access,user}`.
- `POST /api/auth/logout/` requires bearer authentication, clears the cookie, blacklists the refresh token, and revokes the user's existing access sessions. Password reset also revokes existing sessions.
- `POST /api/auth/forgot-password/` accepts `{email}` and always returns the same generic response.
- `POST /api/auth/reset-password/` accepts `{uid,token,password}` from the emailed frontend link.
- `POST /api/auth/verify-email/` accepts `{token}` from the emailed signed link; expiration is 24 hours.
- `POST /api/auth/resend-verification/` is authenticated.
- `POST /api/auth/google/` and `/api/auth/apple/` accept `{id_token}` from the respective client SDK; signing keys, signature, expiration, issuer, audience and verified email are checked. Configure server-side `GOOGLE_CLIENT_ID` or `APPLE_CLIENT_ID` to match the frontend. Do not send provider access tokens in place of identity tokens. Client SDK integrations should enforce their state/nonce flow.
- `GET /api/auth/config/` exposes only provider enablement and email verification requirement flags, never secrets.

All authenticated endpoints accept `Authorization: Bearer <access>`. Staff privileges come from Django, never client payloads. JWTs contain a revocable user session version. Passwords use Django's password hashing and validation.

## Records

`GET/PATCH /api/users/profile/`: `{id,email,full_name,is_staff,email_verified,date_joined,profile}`. Writable profile fields: `avatar_url,age,height_cm,weight_kg,activity_level,dietary_preferences,allergies,timezone,locale,reminder_enabled,reminder_time`. Weight changes append history. Preferences and allergies are arrays of names. `timezone` is a valid IANA zone; summaries use this zone. Profile age requires 13–120 years. `reminder_time` accepts `HH:MM` or null. Reminder preferences are durable; delivery requires a configured scheduler/notification provider.

`GET/POST /api/users/weight-history/` and `DELETE /api/users/weight-history/{id}/`; POST `{weight_kg}` updates the current profile weight.

`GET /api/foods/` or `/api/foods/search/?q=...`: database food records `{id,name,category,category_name,source,source_id,source_url,nutrition}`; nutrition values use the supplied `basis_grams` (default 100). This catalog starts empty. Import sourced food records through the staff API/admin, or use AI estimate lookup against the configured composition provider. No invented catalog fixtures are installed.

`GET/POST /api/meals/`, `GET/PATCH/DELETE /api/meals/{id}/`. Create:

```json
{"name":"Lunch","meal_type":"lunch","eaten_at":"2026-11-10T07:00:00Z","items":[{"name":"User-confirmed food","portion_g":150,"calories":200,"protein":10,"carbohydrates":25,"fat":7,"fiber":null,"sugar":null,"sodium":null,"source":"User correction","is_estimate":true}]}
```

Nutrition values on each meal item are **totals for that portion**, not per 100 g. Accepted AI aliases: `portion_grams`, nested `nutrition`, `carbs`. `recognition_id` optionally links an owner-accessible AI result. Only the owner may list/read/change/delete a meal, water entry, weight entry, notification, recognition result or meal image.

PATCH may include items with their `id` and a new `portion_g`; omitted nutrition fields rescale from the previous portion. New items require name/portion; the supplied item list replaces the previous list. A meal requires 1–50 items. To remove an item omit it from the updated list. Unknown fiber/sugar/sodium stay null and appear in `unknown_nutrients` on items/meal/summaries; totals for those nutrients represent known subtotals. GET meals supports `date`, `start`, `end`, `search`, `meal_type` and `ordering` parameters. Lists use `{count,next,previous,results}` pagination (50 per page).

`GET /api/meals/{id}/image/` returns a private owner-authorized image. JPEG/PNG/WebP only, up to 8 MiB and 20 megapixels. Image content is verified rather than trusting MIME or extension. Recognition uploads are forwarded to the AI provider and not automatically stored as a public asset.

`GET/PUT/PATCH /api/goals/` returns the user's singleton `{goal_type,calories,protein,carbohydrates,fat,water_ml,target_weight_kg}`. Defaults are editable general starting values, not personalized medical recommendations.

`GET/POST /api/water/`, `DELETE /api/water/{id}/`. POST `{amount_ml,recorded_at?}`; GET supports `?date=YYYY-MM-DD`.

`GET /api/notifications/`, `GET/PATCH /api/notifications/{id}/` (`{read:true}` only); `GET /api/achievements/` returns earned record-backed milestones. First/fifth meal and water-goal badges are awarded on corresponding actions.

## Summaries and exports

- `/api/nutrition/daily/?date=YYYY-MM-DD`: `{date,totals,unknown_nutrients,goals,water_ml,streak,meals}`.
- `/api/nutrition/weekly/` and `/api/nutrition/monthly/`: rolling 7/30 days ending on the supplied `date` (defaults to the user's current day).
- `/api/analytics/?period=week|month&date=...`: `{period,start_date,end_date,days,totals,averages,unknown_nutrients,meal_distribution,weight_history,streak,logged_days}`. Day rows contain date, nutrient totals, and water_ml. Averages cover all days in the period. Streak is consecutive days with logged meals, including yesterday if today has no meal.
- `/api/reports/export/?format=csv|pdf&period=day|week|month&date=...`: real owner-filtered download. Optional `start/end` limit to a range of up to 366 days. CSV strings are protected against spreadsheet formula injection.

## AI and integrations

`POST /api/ai/recognize/` and `/api/ai/analyze/` take multipart `image` and optional text `context`. `POST /api/ai/estimate/` accepts `{query,portion_grams}`. These return the validated AI service response plus a durable owner-bound `recognition_id`. AI detection never substitutes fixed predictions when the provider is unavailable.

`POST /api/ai/assistant/`: `{message,history:[{role,content}],context:{}}` -> `{reply,disclaimer}`. `/api/ai/recipes/` and `/api/ai/recommendations/` accept `{query,preferences,allergies,context}`; profile preferences/allergies are supplied if omitted. `/api/integrations/barcode/`: `{barcode,portion_grams}` proxies only the Flask barcode integration. Upstream timeouts/errors return clear 4xx/5xx; an absent internal token returns 503. AI performance metadata excludes uploaded images and assistant text.

## Administration

Django `/admin/` and custom staff-only `/api/admin/summary/`, `/api/admin/users/`, `/api/admin/foods/`, `/api/admin/performance/`, `/api/admin/subscriptions/`. Users may be deactivated with PATCH (self-deactivation prevented). Food management is CRUD with nested sourced nutrition records. Subscription plan/status/period can be updated by staff; no real payment is charged by these endpoints. Performance data is computed from actual analysis logs, without asserting an unmeasured accuracy score.

## Realtime

Connect `/ws/nutrition/`. Within ten seconds send `{"type":"authenticate","token":"<access>"}`. The server replies `{"type":"authenticated"}` and later `{"type":"nutrition.updated"}` after a successful mutation commit. Events are scoped to the authenticated user's group. Tokens do not appear in query strings. Untrusted origins and invalid/expired/revoked tokens are rejected. Expiry/revocation closes with code 4401; reconnect using a refreshed access token. This is a change notification, so refetch affected REST queries.

## Tests

```powershell
$env:USE_SQLITE='true'
$env:DJANGO_DEBUG='true'
python -m pytest -q
python manage.py check
python manage.py makemigrations --check --dry-run
```

Tests use isolated temporary databases; SQLite checks do not substitute for a production PostgreSQL deployment smoke test. AI provider responses are patched only in focused bridge tests; production code always calls the real configured service.
