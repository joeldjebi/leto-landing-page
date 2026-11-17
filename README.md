# LETO · Landing page

Page d'accueil de LETO : toute la page est une carte 3D réelle d'Abidjan (immeubles et routes OpenStreetMap
via OpenFreeMap, sans clé) qui raconte une livraison au fil du défilement : commande au Plateau, trajet
par le pont jusqu'à Marcory, remise avec le code, tournée à Cocody, tarifs, ville de nuit.

- `npm install` puis `npm run dev` → http://localhost:5180
- `npm run build` → dossier `dist/` (site statique à déposer sur le serveur)

Trajets réels : `src/data/routes.json` (calculés par le service d'itinéraire LETO).
Modèles 3D (moto, livreur, personnages) : `src/models.ts` (three.js).
Scènes et caméra : `src/main.ts`.
