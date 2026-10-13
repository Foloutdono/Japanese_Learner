#!/bin/bash
# usage: serve.sh <uid>
pkill -f "[u]vicorn main:app" ; sleep 1
cd "$(dirname "$0")/../../../../backend"
sed -i "s/^DEV_USER_ID=.*/DEV_USER_ID=$1/" .env
nohup ${PYTHON:-python} -m uvicorn main:app --port 8000 > "${FILM_DIR:-/tmp/tsuji-film}/backend.log" 2>&1 &
for i in $(seq 60); do curl -sf localhost:8000/api/profile >/dev/null && break; sleep 1; done
curl -s localhost:8000/api/profile | head -c 300; echo
