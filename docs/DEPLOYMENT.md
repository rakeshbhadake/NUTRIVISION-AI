# Deployment

No cloud resources have been created or charged by this build. Deploy the Python services independently; a static frontend host cannot run Django/FastAPI/Flask processes.

Provider references: [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres), [Vercel external rewrites](https://vercel.com/docs/routing/rewrites), [Vite deployment guide](https://vite.dev/guide/static-deploy).

## Supabase PostgreSQL

Create a Supabase project and copy its **PostgreSQL connection string**, using its session pooler if the hosting network needs IPv4. Use the username/host/port from that project; do not guess them. URL-encode special characters in the password.

```dotenv
DATABASE_URL=postgresql://<database-user>:<encoded-password>@<project-host>:5432/postgres?sslmode=require
USE_SQLITE=false
```

Django owns application tables/migrations. This application does not use Supabase Auth or expose database credentials to the client. Run migrations once per release from the Django container, and back up the database before production changes. Validate migrations, row constraints and concurrent writes on PostgreSQL before accepting live users.

## Django ASGI hosting

Use a Python 3.12 container-compatible ASGI host. Build `backend/django_api/Dockerfile` (or install its requirements).

Release commands:

```sh
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py check --deploy
```

Start:

```sh
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

Set `DJANGO_DEBUG=false`, a random `DJANGO_SECRET_KEY`, exact `DJANGO_ALLOWED_HOSTS`, production `FRONTEND_URL`, explicit `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, `REQUIRE_EMAIL_VERIFICATION=true`, and SMTP credentials. Enable `SECURE_SSL_REDIRECT=true` only behind a correctly configured HTTPS proxy that sets `X-Forwarded-Proto`; do not trust that header from arbitrary clients. Add managed Redis via `REDIS_URL` for realtime and shared rate limits. WhiteNoise serves collected Django Admin assets.

Keep `/api` and the frontend on the same browser origin using the Vercel rewrite below. HttpOnly refresh and CSRF cookies are then first-party. API responses are private and uncacheable. The realtime connection may use a separate explicit `wss://` Django origin; allow the actual frontend origin in Django settings.

For private photo persistence, configure an S3-compatible bucket using the `AWS_*` variables in `.env.example`. Use a private bucket and a least-privilege service credential; users receive photos through owner-authenticated Django endpoints, not permanent public object URLs. Supabase Storage's S3 interface is an option. Do not use ephemeral container disks for durable uploads.

## FastAPI and Flask hosting

Build each service's Dockerfile separately. Restrict service ingress to Django through the hosting network or firewall and set the **same random `INTERNAL_SERVICE_TOKEN`** in all three Python services. Use TLS for service-to-service calls across networks.

FastAPI: `uvicorn app.main:app --host 0.0.0.0 --port 8001`. Set `OPENAI_API_KEY`, a compatible `OPENAI_MODEL`, and `USDA_API_KEY`. Keys are server-only. Validate a genuine image inference with your own approved test image and quota before release. No live vision call was possible in this environment without credentials.

Flask: `gunicorn --bind 0.0.0.0:8002 --workers 2 'app:create_app()'`. Set `WEBHOOK_SIGNING_SECRET`, `OPENFOODFACTS_USER_AGENT` with your contact URL, and a durable writable `WEBHOOK_DATABASE_PATH`. Expose only provider webhook routes if callbacks are required. Current generic HMAC callbacks store verified receipts; add each provider's actual adapter before enabling payments or wearable synchronization. See its README for exact signature/replay semantics.

## Vercel frontend

1. Import this repository into Vercel with root directory `frontend`, Node.js 22, build command `npm ci && npm run build`, output directory `dist`.
2. Copy `frontend/vercel.json.example` to `frontend/vercel.json` and replace `REPLACE-WITH-DJANGO-HOST` with your deployed HTTPS Django host. It provides the SPA route fallback and same-origin `/api` rewrite. Never put credentials in a rewrite URL.
3. Set `VITE_API_URL=/api` and `VITE_WS_URL=wss://<your-django-host>/ws/nutrition/`. Only public client IDs may use `VITE_`. Set configured OAuth IDs to match Django. Rebuild after changing Vite variables.
4. Register the final HTTPS web origin and redirect URI with Google/Apple; test real sign-in, state/nonce behavior and provider email verification requirements with those accounts. Enable SMTP and confirm verification/reset links use the public `FRONTEND_URL`.
5. Test the refresh cookie and CSRF flow through the deployed rewrite, WebSocket updates between two sessions, camera/microphone over HTTPS, protected downloads, and private storage. Confirm API and image responses are not cached by any proxy/CDN.

## Production acceptance

Automated local tests are documented in `docs/TESTING.md`. Before production, supply and verify provider credentials, a real PostgreSQL deployment, object storage, email delivery, HTTPS/trusted origins, Redis, backups, and host-specific runtime limits. Image estimates are not measurements; keep the visible review step and source labels. No accuracy statistic is displayed without an evaluated dataset.
