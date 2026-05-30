#!/bin/sh
set -eu

cat > /usr/share/nginx/html/env-config.js <<EOF
window.__APP_CONFIG__ = {
  apiBaseUrl: "${VITE_API_BASE_URL:-http://172.20.20.5:4001/api}",
  planningStart: "${VITE_PLANNING_START:-2026-03-12}",
  planningDays: "${VITE_PLANNING_DAYS:-100}"
};
EOF
