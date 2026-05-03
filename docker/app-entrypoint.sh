#!/bin/sh
set -e

# Replace build-time placeholders with actual runtime env vars.
# Targets both the server chunks and the static client JS bundle.
replace() {
  local placeholder=$1
  local value=$2
  find /app/.next -type f \( -name "*.js" -o -name "*.json" \) | \
    xargs sed -i "s|${placeholder}|${value}|g"
}

replace "__NEXT_PUBLIC_SUPABASE_URL__"      "${NEXT_PUBLIC_SUPABASE_URL}"
replace "__NEXT_PUBLIC_SUPABASE_ANON_KEY__" "${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
replace "__NEXT_PUBLIC_VAPID_PUBLIC_KEY__"  "${NEXT_PUBLIC_VAPID_PUBLIC_KEY}"
replace "__NEXT_PUBLIC_APP_URL__"           "${NEXT_PUBLIC_APP_URL}"

echo "Runtime env vars injected — starting Next.js"

# Drop to non-root user and start the server
exec su-exec nextjs node server.js
