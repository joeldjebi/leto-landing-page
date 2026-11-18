# LETO · Landing page

Page d'accueil de LETO : toute la page est une carte 3D réelle d'Abidjan (immeubles et routes OpenStreetMap
via OpenFreeMap, sans clé) qui raconte une livraison au fil du défilement : commande au Plateau, trajet
par le pont jusqu'à Marcory, remise avec le code, tournée à Cocody, tarifs, ville de nuit.

- `npm install` puis `npm run dev` → http://localhost:5180
- `npm run build` → dossier `dist/` (site statique à déposer sur le serveur)

Trajets réels : `src/data/routes.json` (calculés par le service d'itinéraire LETO).
Modèles 3D (moto, livreur, personnages) : `src/models.ts` (three.js).
Scènes et caméra : `src/main.ts`.

## Mise en ligne

Site statique (dossier `dist/`). Sur le serveur, une fois le dépôt cloné dans `/var/www/leto/leto-landing-page` :

```bash
cd /var/www/leto/leto-landing-page && SITE_URL=https://votre-domaine WEB_ROOT=/chemin/du/dossier/du/domaine bash deploy/update.sh
```

- `SITE_URL` : adresse du site (aperçus WhatsApp / Facebook, Google).
- `WEB_ROOT` : dossier servi par le domaine (par ex. le `public_html` du compte cPanel).
- `.htaccess` fourni : HTTPS, compression, cache, règles de sécurité (carte OpenFreeMap, polices Google).

Modes : allégé automatiquement sur les téléphones modestes ou en connexion lente ; sans 3D, la page reste
complète sur une image de la ville.
