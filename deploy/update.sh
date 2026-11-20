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
# Fichiers de public/ servis avec un cache d'un an : la page vidéo les appelle avec leur empreinte
# (video.js?v=…), sinon les navigateurs garderaient l'ancienne version après une mise à jour
echo "→ Versions des fichiers de la page vidéo"
for f in video.js video.css; do
  [ -f "dist/video/$f" ] || continue
  h=$( (md5sum "dist/video/$f" 2>/dev/null || md5 -r "dist/video/$f") | cut -c1-10)
  perl -pi -e "s#(href|src)=\"\Q$f\E(\?v=[0-9a-f]+)?\"#\$1=\"$f?v=$h\"#g" dist/video/index.html
done
echo "→ Publication dans $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rsync -a --delete --exclude '.well-known' --exclude 'pro' dist/ "$WEB_ROOT/"
[ -n "${CPUSER:-}" ] && chown -R "$CPUSER:$CPUSER" "$WEB_ROOT"
echo "✓ Landing page à jour : $SITE_URL"
