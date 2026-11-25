"""Run all services locally. Ctrl+C stops the owned processes."""
import argparse
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--setup', action='store_true', help='Install dependencies and migrate before starting')
args = parser.parse_args()
services = ['django_api', 'fastapi_ai', 'flask_integrations']
npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
if not npm:
    raise SystemExit('Install Node.js 22 and npm first.')
if not (ROOT / '.env').exists():
    raise SystemExit('First run python infrastructure/configure_local.py [--sqlite], then edit .env.')

def python_for(name):
    return ROOT / 'backend' / name / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')

if args.setup:
    for name in services:
        folder = ROOT / 'backend' / name
        if not python_for(name).exists():
            subprocess.run([sys.executable, '-m', 'venv', str(folder / '.venv')], check=True)
        subprocess.run([str(python_for(name)), '-m', 'pip', 'install', '-r', 'requirements.txt'], cwd=folder, check=True)
    subprocess.run([npm, 'ci', '--no-audit', '--no-fund'], cwd=ROOT / 'frontend', check=True)
    subprocess.run([str(python_for('django_api')), 'manage.py', 'migrate'], cwd=ROOT / 'backend/django_api', check=True)

for name in services:
    if not python_for(name).exists():
        raise SystemExit(f'{name}: dependencies missing; rerun with --setup.')

processes = []
commands = [
    ('django_api', [str(python_for('django_api')), 'manage.py', 'runserver', '127.0.0.1:8000', '--noreload']),
    ('fastapi_ai', [str(python_for('fastapi_ai')), '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8001']),
    ('flask_integrations', [str(python_for('flask_integrations')), '-m', 'waitress', '--host=127.0.0.1', '--port=8002', '--call', 'app:create_app']),
]
try:
    for name, command in commands:
        processes.append(subprocess.Popen(command, cwd=ROOT / 'backend' / name))
    processes.append(subprocess.Popen([npm, 'run', 'dev'], cwd=ROOT / 'frontend'))
    print('\nNutriVision: http://127.0.0.1:5173 | Django :8000 | AI :8001 | integrations :8002\n', flush=True)
    while all(process.poll() is None for process in processes):
        time.sleep(.5)
except KeyboardInterrupt:
    print('\nStopping local services…', flush=True)
finally:
    for process in processes:
        if process.poll() is None:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                process.terminate()
    for process in processes:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
