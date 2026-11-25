"""Create a private local config without printing or committing credentials."""
import argparse
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--sqlite', action='store_true', help='Use the explicit local SQLite fallback')
args = parser.parse_args()
target = root / '.env'
if target.exists():
    raise SystemExit('.env already exists; edit it directly. Nothing was overwritten.')
values = (root / '.env.example').read_text(encoding='utf-8')
postgres_password = secrets.token_urlsafe(32)
replacements = {
    'DJANGO_SECRET_KEY=': secrets.token_urlsafe(64),
    'INTERNAL_SERVICE_TOKEN=': secrets.token_urlsafe(48),
    'WEBHOOK_SIGNING_SECRET=': secrets.token_urlsafe(48),
    'POSTGRES_PASSWORD=': postgres_password,
}
lines = []
for line in values.splitlines():
    if line in replacements:
        line += replacements[line]
    if line.startswith('DATABASE_URL='):
        line = f'DATABASE_URL=postgresql://nutrivision:{postgres_password}@127.0.0.1:5432/nutrivision'
    if args.sqlite and line == 'USE_SQLITE=false':
        line = 'USE_SQLITE=true'
    lines.append(line)
target.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print('Created private .env with random local secrets. Add provider keys to enable AI. No secrets printed.')
