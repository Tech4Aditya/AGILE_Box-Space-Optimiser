#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PYTHON="$(command -v python3 || command -v python)"
"$PYTHON" -c 'import sys; assert sys.version_info >= (3,10), "Python 3.10+ required"'
if [ ! -x .venv/bin/python ]; then "$PYTHON" -m venv .venv; fi
.venv/bin/python -m pip install --disable-pip-version-check -r backend/requirements.txt
echo "BoxSpace UI: http://127.0.0.1:8000"
echo "API docs:   http://127.0.0.1:8000/docs"
exec .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
