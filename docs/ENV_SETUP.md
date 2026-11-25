# NutriVision .env setup, field by field

Start locally with the existing SQLite configuration. Enable external services one at a time. Most fields are settings that you choose; only provider credentials come from provider dashboards.

Root server configuration:

```text
C:\Users\rakesh bhadake\Documents\NUTRI AI\nutrivision-ai\.env
```

Optional public browser configuration:

```text
C:\Users\rakesh bhadake\Documents\NUTRI AI\nutrivision-ai\frontend\.env.local
```

Never copy the server `.env` into the frontend. Server processes load the root file automatically. Restart all services after editing it. Environment variables already set in the process take precedence over `.env` values.

The file must be named `.env`, not `.env.txt`. Use one `NAME=value` per line. Leave optional values empty as `NAME=`. Quote values with spaces or `#`, such as `DEFAULT_FROM_EMAIL="NutriVision <you@gmail.com>"`. Do not paste keys into chat, source files, screenshots or Git. Replace the local secrets previously shared in chat before deployment; this guide contains no real credentials.

## 1. Values you generate yourself

Run this command separately for each secret:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

| Field | Use |
| --- | --- |
| `DJANGO_SECRET_KEY` | A unique random value for Django signing/JWT infrastructure. Keep stable between restarts. Changing it invalidates existing signed credentials/links. |
| `INTERNAL_SERVICE_TOKEN` | A different random value. Django, FastAPI and Flask must use exactly the same value so internal requests authenticate. The local launcher reads one root file for all three. |
| `WEBHOOK_SIGNING_SECRET` | Another different random value for this app's generic HMAC webhook signature. An external adapter signing these requests must use the same secret. It is not a Stripe/wearable-provider key. |
| `POSTGRES_PASSWORD` | Another random password for a new local Docker PostgreSQL instance. It is not used by SQLite. If configuring native local PostgreSQL, create the database role with a matching password. |

For an existing database, changing an environment variable does not change the database role's actual password. If changing a local PostgreSQL password, update the database role and the `DATABASE_URL` password together. A Supabase database password is managed separately in its dashboard. [Python secrets reference](https://docs.python.org/3/library/secrets.html).

## 2. Local app settings: keep these values

| Field | Local value | Meaning |
| --- | --- | --- |
| `DJANGO_DEBUG` | `true` | Development error pages; use `false` on production hosts. |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,django` | Allowed Django hostnames, without scheme/path/port. `django` is the Compose service name. |
| `FRONTEND_URL` | `http://127.0.0.1:5173` | Browser app address, also used in emailed links. |
| `CORS_ALLOWED_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Allowed browser origins, with scheme and port, no path. |
| `CSRF_TRUSTED_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Trusted browser origins for protected cookie-auth requests. |
| `SECURE_SSL_REDIRECT` | `false` | Local development uses HTTP. Enable only after configuring production HTTPS/proxy headers. |
| `REQUIRE_EMAIL_VERIFICATION` | `false` | Allows local signup without delivered email. Enable after testing real mail delivery. |
| `USE_SQLITE` | `true` | Runs without installing PostgreSQL. With this value, Django ignores `DATABASE_URL`. |
| `AI_SERVICE_URL` | `http://127.0.0.1:8001` | Local FastAPI address, not an OpenAI URL. |
| `INTEGRATIONS_SERVICE_URL` | `http://127.0.0.1:8002` | Local Flask address. |
| `REDIS_URL` | blank | Uses in-memory cache/Channels for a single local worker. |
| `WEBHOOK_DATABASE_PATH` | `./data/webhooks.sqlite3` | Durable integration receipt/replay ledger; not the main nutrition database. Relative to the Flask process working directory, so the launcher places it under `backend/flask_integrations/data`. |

Use the same browser hostname consistently: open `http://127.0.0.1:5173` for the supplied configuration. Switching between localhost and 127.0.0.1 changes the cookie host.

## 3. OpenAI: enable photo recognition, assistant and recipes

1. Sign in to [OpenAI Platform](https://platform.openai.com/).
2. Select the API project you want to use for NutriVision.
3. Open [API keys](https://platform.openai.com/api-keys), create a new secret key, and save it locally when displayed.
4. Check the selected API organization's billing/available credits and model access. A key alone does not supply API quota.
5. Paste the key only into the root server `.env`:

```dotenv
OPENAI_API_KEY=PASTE_YOUR_REAL_API_KEY_HERE
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_MODEL` is a model identifier, not a second secret. Keep the current model while configuring the app. It supports image input and structured output, as this app requires; actual access depends on your API project. Missing/invalid credentials or exhausted quota cause an error rather than fake food predictions. [Official key setup](https://developers.openai.com/api/docs/quickstart), [model capabilities](https://developers.openai.com/api/docs/models/gpt-4o-mini).

If the API returns `credit_balance_exhausted`, open the key's organization's [API billing settings](https://platform.openai.com/settings/organization/billing) and add available API credits. An active key does not establish a positive credit balance. Once the balance is updated, retry the scan; generating more keys or repeatedly retrying does not restore an exhausted balance. `rate_limit_exceeded` or `slow_down` instead calls for pacing requests. The app distinguishes these cases without exposing provider response details. [OpenAI error codes](https://developers.openai.com/api/docs/guides/error-codes).

## 4. USDA: nutrition composition enrichment

1. Open [FoodData Central API signup](https://fdc.nal.usda.gov/api-key-signup/).
2. Complete the data.gov API-key signup using your name/email.
3. Copy the issued key into root `.env`:

```dotenv
USDA_API_KEY=PASTE_YOUR_FOODDATA_CENTRAL_KEY_HERE
```

This is separate from OpenAI. It supplies food-composition lookups after food recognition. It does not identify foods in an image by itself. Without this key the app can still return clearly labeled AI nutrition estimates. [USDA access instructions](https://fdc.nal.usda.gov/api-guide/).

For barcode lookup, no Open Food Facts API key is needed. Identify your app with your real contact details:

```dotenv
OPENFOODFACTS_USER_AGENT="NutriVisionAI/1.0 (you@example.com)"
```

The contact email is chosen by you; it is not a password or provider token. [Open Food Facts identification requirements](https://openfoodfacts.github.io/openfoodfacts-server/api/).

## 5. Database: choose one mode

**Current SQLite mode:** leave `USE_SQLITE=true`. No PostgreSQL installation, account or connection is required. Existing `DATABASE_URL` and `POSTGRES_*` values can remain; SQLite does not use them.

**Bundled Docker PostgreSQL:** `POSTGRES_DB=nutrivision` and `POSTGRES_USER=nutrivision` are names you choose. Generate `POSTGRES_PASSWORD` yourself. Compose uses these values to initialize its `db` container and automatically constructs Django's internal database URI. It also supplies service URLs and Redis. A pre-existing database volume keeps its existing password until the database role is explicitly changed.

**Native PostgreSQL on your PC:** first create the role/database using your PostgreSQL administration tool, then use those exact names/password and local server address in `DATABASE_URL` and set `USE_SQLITE=false`.

**Supabase PostgreSQL:**

1. Create a project at [Supabase](https://supabase.com/dashboard); save the database password selected during creation.
2. Open the project's **Connect** panel. Copy its PostgreSQL **Session pooler** URI if your local/hosting network needs IPv4.
3. Keep the copied hostname, database name, username and port exactly as supplied. Replace only the password placeholder with the database password, URL-encoding reserved characters. This password is not your Supabase account login password or an API key.
4. Set:

```dotenv
USE_SQLITE=false
DATABASE_URL=postgresql://COPIED_USERNAME:URL_ENCODED_DATABASE_PASSWORD@COPIED_POOLER_HOST:5432/postgres?sslmode=require
```

If the URI already has query parameters, append `&sslmode=require` rather than a second `?`. The direct database host is also valid when your network can reach it; do not replace a copied pooler host with a guessed regional hostname. [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

5. Because this app uses Django ORM for database access, disable the unused **Data API** for this project before storing real user records, unless you separately configure and audit its RLS/grants. Django endpoint permissions do not govern Supabase Data API access. [Supabase instructions](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api).
6. From the project root, apply migrations:

```powershell
backend\django_api\.venv\Scripts\python.exe backend\django_api\manage.py migrate
```

Switching databases does not automatically copy existing SQLite users/meals. `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` are used by the bundled Docker database, not by a manually launched Django connection to Supabase. Also, the supplied `docker-compose.yml` overrides `DATABASE_URL` to use its local `db` service; pointing Compose at Supabase requires changing that override.

## 6. Email: console first, SMTP when ready

For local work, keep `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`. `EMAIL_HOST`, `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` may be blank. Email contents/reset links appear in the Django terminal; no message is delivered. Keep `REQUIRE_EMAIL_VERIFICATION=false` initially.

One SMTP option is an eligible Gmail account:

1. Enable 2-Step Verification on the sender account.
2. Open [Google App Passwords](https://myaccount.google.com/apppasswords) and create an app password for NutriVision. Availability depends on account policies.
3. Use that app password, without display spaces, rather than your normal Google password:

```dotenv
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=your-address@gmail.com
EMAIL_HOST_PASSWORD=YOUR_GOOGLE_APP_PASSWORD
DEFAULT_FROM_EMAIL="NutriVision <your-address@gmail.com>"
REQUIRE_EMAIL_VERIFICATION=false
```

`EMAIL_HOST` is the SMTP server; `EMAIL_PORT` is its STARTTLS port; `EMAIL_USE_TLS` enables STARTTLS; user/password come from that provider; `DEFAULT_FROM_EMAIL` must be a sender the provider permits. A transactional SMTP provider can supply the same fields. This app's configuration exposes STARTTLS and does not read `EMAIL_USE_SSL`, so do not substitute port 465 without changing code. [Google App Passwords](https://support.google.com/mail/answer/185833), [Gmail SMTP settings](https://developers.google.com/workspace/gmail/imap/imap-smtp).

Restart the services, request a password-reset email for a registered account, and confirm receipt. Only then set `REQUIRE_EMAIL_VERIFICATION=true` if you want verification enforced.

## 7. Google sign-in: optional

1. Open [Google Cloud Console](https://console.cloud.google.com/), create/select a project, and configure **Google Auth Platform** branding/audience. Add test users where the chosen testing configuration requires them.
2. Under **Clients**, create a client of type **Web application**.
3. Add the exact frontend **Authorized JavaScript origins** you use, including scheme and port, without a path:

```text
http://127.0.0.1:5173
http://localhost:5173
```

4. Copy the client ID ending in `.apps.googleusercontent.com` into both files:

```dotenv
# Root .env
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

```dotenv
# frontend/.env.local
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

The current app receives a Google ID token through the browser SDK callback and validates it in Django. It does not use a Google client-secret field or a redirect-based code exchange. The client ID is intentionally public. [Google setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [authorized-origin rules](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow).

## 8. Apple sign-in: optional, use a deployed HTTPS domain

Leave Apple fields empty for initial local work. Apple web sign-in needs an Apple Developer setup with a Services ID associated with a primary App ID that enables Sign in with Apple. Configure the website domain and return URL, then use the **Services ID** as the client ID:

```dotenv
# Root .env
APPLE_CLIENT_ID=com.yourcompany.nutrivision.web
```

```dotenv
# frontend/.env.local
VITE_APPLE_CLIENT_ID=com.yourcompany.nutrivision.web
VITE_APPLE_REDIRECT_URI=https://your-real-domain.example/login
```

Replace the example with your actual registered HTTPS URL. Apple does not permit localhost/IP return URLs. The current code uses the returned identity token; there are no `.p8`/Apple-client-secret environment fields for a separate authorization-code exchange. Live provider testing is still required. [Apple web setup](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/), [return URL rules](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple).

## 9. Optional private cloud photo storage

Leave every `AWS_*` field blank initially. When `AWS_STORAGE_BUCKET_NAME` is blank, Django uses local private file storage; the region default is unused.

For Supabase Storage:

1. Create a **private** bucket, for example `meal-photos`.
2. Open **Storage → Configuration → S3**. Generate an S3 Access Key ID and Secret Access Key; copy the S3 endpoint and region shown there.
3. Set:

```dotenv
AWS_STORAGE_BUCKET_NAME=meal-photos
AWS_ACCESS_KEY_ID=YOUR_S3_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_S3_SECRET_ACCESS_KEY
AWS_S3_ENDPOINT_URL=YOUR_COPIED_S3_ENDPOINT
AWS_S3_REGION_NAME=YOUR_COPIED_PROJECT_REGION
```

The endpoint is an HTTPS S3 URL, commonly `https://PROJECT_REF.storage.supabase.co/storage/v1/s3`; copy yours rather than deriving it. These credentials are not your Supabase publishable/anon/service-role API keys. Do not keep `ap-south-1` unless it matches the displayed project region. S3 access keys are privileged server credentials. [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication).

Django settings use signed URLs, path-style requests for custom endpoints, SigV4, and no per-object ACL header. The bucket must itself be private. These settings accommodate Supabase's documented S3 differences. Cloud uploads remain unverified until you supply a real bucket/credentials. [S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility).

For native AWS S3, use your private S3 bucket, its region, and a least-privilege IAM credential allowed to access that bucket. Leave `AWS_S3_ENDPOINT_URL` blank for ordinary AWS endpoints.

## 10. Optional Redis

Keep `REDIS_URL=` for a single local worker. For a managed service, copy its **native Redis connection URI**, not its HTTP REST URL/token. Example shape only:

```dotenv
REDIS_URL=rediss://default:URL_ENCODED_PASSWORD@HOST:PORT/0
```

`rediss://` uses TLS. The bundled Docker stack configures `redis://redis:6379/0` on its private development network. [Redis connection URL reference](https://redis.io/docs/latest/develop/clients/connection-urls/).

## 11. Minimal browser .env

Create `frontend/.env.local` only when you need to customize public settings:

```dotenv
VITE_API_URL=/api
VITE_WS_URL=
VITE_GOOGLE_CLIENT_ID=
VITE_APPLE_CLIENT_ID=
VITE_APPLE_REDIRECT_URI=
```

Local Vite proxies `/api` and `/ws` to Django. For production, set `VITE_WS_URL` to your Django `wss://.../ws/nutrition/` URL, configure same-origin API rewrites, and add the public web origin to Django's trusted origins. Any `VITE_` value is exposed to the browser; use that prefix only for public settings.

## 12. Start and verify

```powershell
Set-Location 'C:\Users\rakesh bhadake\Documents\NUTRI AI\nutrivision-ai'
python infrastructure/dev.py
# On a fresh checkout with missing dependencies, use: python infrastructure/dev.py --setup
```

Open `http://127.0.0.1:5173`, create your account, and try manual food entry first. Then test a food photo after adding OpenAI, composition enrichment after USDA, SMTP delivery, and each optional login/storage provider separately. Restart after `.env` edits; Vite also needs a restart/rebuild after public variable edits.

For a first successful local run, the changes you normally need are only `OPENAI_API_KEY`, `USDA_API_KEY`, and a real `OPENFOODFACTS_USER_AGENT` contact; the generated local secrets and supplied local addresses already have the right form. This guide does not claim that credentials were created, inserted or tested on your behalf.
