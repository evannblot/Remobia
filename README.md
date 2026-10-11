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

## Publication sur Vercel

Le fichier `vercel.json` compile les pages avec Next.js et conserve le parcours Vinext pour Sites. Pour vérifier cette compilation localement :

```sh
VERCEL=1 npx next build --webpack
```

Les pages publiques sont compatibles avec Vercel. L’envoi des devis peut être activé en renseignant `RESEND_API_KEY`, `QUOTE_FROM_EMAIL` et `QUOTE_TO_EMAIL` dans les variables privées du projet Vercel, avec un domaine expéditeur vérifié.

Le déploiement Vercel utilise Neon Postgres et un stockage Vercel Blob **privé**. Les routes d’images rendent publiques uniquement les photos des annonces publiées ; les reprises, brouillons et annonces vendues nécessitent la session du propriétaire. La connexion Google est gérée par Neon Auth. L’email doit être vérifié et correspondre à `SITE_ADMIN_EMAIL`. Les entêtes d’identité Sites ne sont jamais considérées comme une preuve sur Vercel.

Si Neon renvoie une origine OAuth différente de l’URL de base, déclarer son origine exacte dans `NEON_AUTH_REDIRECT_ORIGIN`. Elle doit appartenir au même endpoint et à la même région ; seul le chemin d’initialisation de connexion est accepté. Aucune origine générique `*.neon.tech` n’est autorisée.

Si cette adresse alternative renvoie `endpoint not found`, renseigner l’URL canonique affichée dans la console Neon dans `NEON_AUTH_BASE_URL_OVERRIDE`. Le démarrage de connexion utilise alors cet hôte pour le seul chemin d’initialisation, après validation de l’alias exact du même endpoint. Les paramètres OAuth restent inchangés.

Le déploiement exécute `scripts/migrate-vercel.mjs` avant la compilation pour appliquer `migrations/vercel/001_remobia.sql`. Cette migration crée le schéma dans une transaction et peut être relancée sans effacer les données. Un échec arrête le déploiement. Les transactions applicatives utilisent l’isolation Serializable. Les fichiers sont réencodés côté navigateur en JPEG, sans métadonnées EXIF, limités à 900 Kio chacun et quatre photos. Le serveur plafonne le corps multipart Vercel à 4 Mio.

Configurer les variables privées de `.env.example`, puis redéployer. La disponibilité des reprises vérifie les tables nécessaires. L’envoi des emails reste désactivé tant que `EMAIL_DELIVERY_ENABLED=true` n’est pas configuré après une vérification réelle. L’expéditeur de test Resend ne permet d’envoyer qu’à l’adresse du compte Resend ; un domaine expéditeur vérifié permet les destinataires habituels.

Une notification de reprise est ajoutée à une file durable dans la transaction de sauvegarde. L’envoi se fait après la réponse au client. Un échec laisse la demande et ses photos intactes. Les notifications en attente sont également retentées à l’ouverture authentifiée de la liste des reprises. Les devis utilisent une clé d’idempotence stable pour les nouvelles tentatives de la même demande (fenêtre Resend de 24 heures). Un timeout ne produit jamais un faux succès.

Si une transaction Vercel a peut-être abouti mais que sa réponse a été perdue, ses nouvelles photos sont conservées pour éviter de casser une annonce sauvegardée. Une vérification ultérieure peut être nécessaire pour nettoyer des objets privés orphelins.

Aucune donnée client ni photo privée n’est copiée lors de cette publication.

## Configuration privée

Le fichier `.env.example` documente les variables avec des valeurs vides. Renseigner les valeurs localement dans `.dev.vars` ou dans les paramètres privés de l’hébergeur :

- `SITE_ADMIN_EMAIL` : compte propriétaire autorisé à gérer les annonces et les reprises.
- `RESEND_API_KEY`, `QUOTE_FROM_EMAIL`, `QUOTE_TO_EMAIL` : envoi des demandes de réparation et des demandes d’informations par email.

Les demandes de reprise sont enregistrées pour consultation dans l’espace propriétaire et déclenchent une notification lorsque le service email est activé. Les photos se consultent via le lien privé de l’espace propriétaire. Le bouton de réponse ouvre la messagerie du propriétaire.

Aucune clé, base de données, photo client ou fichier de configuration privé n’est inclus dans ce dépôt. Le cache de compilation et les dépendances sont exclus. Aucun mot de passe, code de déverrouillage ou numéro IMEI n’est demandé par le formulaire de reprise.

## Version exportée

Sources issues de la version Sites `0debc8eb0f2514414f60d7ffd4c1efd49849b5fc`. L’export ajoute cette documentation, conserve la documentation initiale dans `docs/SITES_SETUP.md`, retire le cache de compilation et rend explicites les valeurs factices des tests.
