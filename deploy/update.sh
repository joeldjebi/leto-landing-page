#!/usr/bin/env bash
# Met à jour la landing page LETO sur le serveur :
#   cd /var/www/leto/leto-landing-page && SITE_URL=https://votre-domaine WEB_ROOT=/chemin/du/site bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SITE_URL:?Indiquez SITE_URL, ex. SITE_URL=https://leto.ci}"
: "${WEB_ROOT:?Indiquez WEB_ROOT, le dossier servi par le domaine (ex. /home/compte/public_html)}"

echo "→ Récupération du code"
git pull --ff-only
echo "→ Dépendances"
npm ci --no-audit --no-fund
echo "→ Construction (SITE_URL=$SITE_URL)"
SITE_URL="$SITE_URL" npm run build
echo "→ Publication dans $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rsync -a --delete --exclude '.well-known' dist/ "$WEB_ROOT/"
echo "✓ Landing page à jour : $SITE_URL"
