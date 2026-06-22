#!/usr/bin/env bash
# ============================================================================
# Transworld Client Engagement — automated deploy
# Writes local env, installs, validates the build, then pushes to GitHub
# (which triggers the connected Vercel project to build and deploy).
#
# Run from inside the extracted folder:   chmod +x deploy.sh && ./deploy.sh
# Requires a filled-in ./deploy.config (copied from deploy.config.example).
# Nothing secret is ever committed: .env.local and deploy.config are excluded.
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")"

say()  { printf "\n\033[1;34m▸ %s\033[0m\n" "$1"; }
ok()   { printf "  \033[0;32m✓ %s\033[0m\n" "$1"; }
die()  { printf "\n\033[0;31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

# --- 1. Load + validate config --------------------------------------------
[ -f deploy.config ] || die "No deploy.config found. Copy deploy.config.example to deploy.config and fill it in."
# shellcheck disable=SC1091
source ./deploy.config

require() { [ -n "${!1:-}" ] || die "Missing $1 in deploy.config"; }
require SUPABASE_URL
require SUPABASE_SERVICE_ROLE_KEY
require JWT_SECRET
require GIT_REMOTE
ok "Config loaded"

# --- 2. Write local .env.local (for npm run dev; NOT pushed) ---------------
say "Writing .env.local"
cat > .env.local <<EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
JWT_SECRET=${JWT_SECRET}
RESEND_API_KEY=${RESEND_API_KEY:-}
MAIL_FROM=${MAIL_FROM:-Transworld <noreply@transworldltd.com.ng>}
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
CRON_SECRET=${CRON_SECRET:-}
GREETINGS_REMINDER_TO=${GREETINGS_REMINDER_TO:-}
EOF
ok ".env.local written"

# --- 3. Install + validate build ------------------------------------------
say "Installing dependencies"
npm install --no-audit --no-fund
ok "Dependencies installed"

say "Validating production build"
npm run build >/dev/null
ok "Build passed"

# --- 4. Push snapshot to GitHub (preserves history) -----------------------
say "Publishing to GitHub"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if git clone "${GIT_REMOTE}" "$WORK/repo" 2>/dev/null; then
  ok "Cloned existing repository"
else
  mkdir -p "$WORK/repo"
  git -C "$WORK/repo" init -q
  git -C "$WORK/repo" remote add origin "${GIT_REMOTE}"
  ok "Initialized fresh repository"
fi

# Overlay this snapshot onto the repo working tree. --delete keeps the repo an
# exact mirror of the zip; local-only and secret files are never copied.
rsync -a --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='.env.local' \
  --exclude='deploy.config' \
  --exclude='LICENSE' \
  ./ "$WORK/repo/"

cd "$WORK/repo"
git add -A
if git diff --cached --quiet; then
  ok "No changes since last deploy — nothing to push"
else
  git -c user.email="${GIT_EMAIL:-deploy@transworldltd.com.ng}" \
      -c user.name="${GIT_NAME:-Transworld Deploy}" \
      commit -q -m "${DEPLOY_MESSAGE:-Deploy}"
  git branch -M main
  git push -u origin main
  ok "Pushed to GitHub — Vercel is now building"
fi

say "Done. Watch the build at Vercel ▸ Deployments."
printf "  Live URL: %s\n\n" "${NEXT_PUBLIC_APP_URL:-https://transworld-engagement.vercel.app}"
