# REMOBIA

Site de réparation, reprise et vente de téléphones reconditionnés à Laval (Mayenne).

## Fonctionnalités

- Accueil minimaliste avec la palette aubergine, ivoire, céladon et corail.
- Demande de devis de réparation en trois étapes, avec description obligatoire.
- Catalogue de téléphones et espace propriétaire pour gérer les annonces.
- Demande de reprise à distance : caractéristiques, état, problèmes, coordonnées, photos avant et arrière obligatoires, deux photos supplémentaires possibles.
- Espace privé pour lire les demandes de reprise et leurs photos, puis contacter le client.
- Mise en page adaptée aux ordinateurs et téléphones. Les emplacements photo attendent les visuels du propriétaire.

## Lancer le projet

Node.js récent requis (Node 24 recommandé pour les tests).

```sh
npm ci
npm run dev
```

L’aperçu local est disponible à l’adresse indiquée par le serveur, généralement http://127.0.0.1:5173.

```sh
npm run build
node --experimental-strip-types --test tests/*.test.mjs
```

## Hébergement et données

Le site utilise React, TypeScript et Vinext, avec un serveur Cloudflare Workers. D1 conserve les annonces et demandes de reprise ; R2 conserve les photos. Les migrations SQL se trouvent dans `drizzle/`.

Ce dépôt contient la version complète du site. GitHub Pages héberge uniquement des fichiers statiques et ne peut pas exécuter ces fonctions serveur. Le site existant reste hébergé sur Sites :
https://atelier-mobile-laval.clopinette-001.chatgpt.site

La configuration et les commandes de migration locale sont détaillées dans [docs/SITES_SETUP.md](docs/SITES_SETUP.md). Les contrôles de disponibilité empêchent de déclarer un enregistrement ou un envoi réussi tant que les services requis ne sont pas configurés.

## Configuration privée

Le fichier `.env.example` documente les variables avec des valeurs vides. Renseigner les valeurs localement dans `.dev.vars` ou dans les paramètres privés de l’hébergeur :

- `SITE_ADMIN_EMAIL` : compte propriétaire autorisé à gérer les annonces et les reprises.
- `RESEND_API_KEY`, `QUOTE_FROM_EMAIL`, `QUOTE_TO_EMAIL` : envoi des demandes de réparation et des demandes d’informations par email.

Les demandes de reprise sont enregistrées pour consultation dans l’espace propriétaire. Elles ne déclenchent actuellement aucune notification email automatique. Le bouton de réponse ouvre la messagerie du propriétaire.

Aucune clé, base de données, photo client ou fichier de configuration privé n’est inclus dans ce dépôt. Le cache de compilation et les dépendances sont exclus. Aucun mot de passe, code de déverrouillage ou numéro IMEI n’est demandé par le formulaire de reprise.

## Version exportée

Sources issues de la version Sites `0debc8eb0f2514414f60d7ffd4c1efd49849b5fc`. L’export ajoute cette documentation, conserve la documentation initiale dans `docs/SITES_SETUP.md`, retire le cache de compilation et rend explicites les valeurs factices des tests.
