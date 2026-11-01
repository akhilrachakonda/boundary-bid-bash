"""Run only with the official native stack's --env output; no hosted credentials."""
import os, shlex, sys
from pathlib import Path
from urllib.parse import urlparse

if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/start-isolated-app.py /tmp/local-stack.env')
values = {}
for line in Path(sys.argv[1]).read_text().splitlines():
    if '=' in line:
        key, value = line.split('=', 1)
        values[key] = shlex.split(value)[0]
url = urlparse(values['API_URL'])
if url.hostname != '127.0.0.1' or url.port != 54321:
    raise SystemExit('Refusing non-isolated API endpoint')
env = {key: os.environ[key] for key in ['PATH', 'HOME', 'NODE_PATH'] if key in os.environ}
env.update(VITE_SUPABASE_URL=values['API_URL'], VITE_SUPABASE_PUBLISHABLE_KEY=values['PUBLISHABLE_KEY'],
           SUPABASE_URL=values['API_URL'], SUPABASE_PUBLISHABLE_KEY=values['PUBLISHABLE_KEY'])
os.execvpe('bun', ['bun', 'x', 'vite', '--config', 'scripts/isolated-vite.config.ts'], env)