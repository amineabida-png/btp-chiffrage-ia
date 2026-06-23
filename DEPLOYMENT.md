# 📘 Guide de déploiement pas-à-pas — GitHub + Railway

Ce guide vous mène de zéro à une application **en ligne et fonctionnelle**, même sans expérience technique. Comptez **15 à 20 minutes**.

---

## 🧩 Ce dont vous avez besoin

1. Un compte **GitHub** (gratuit) → https://github.com
2. Un compte **Railway** (gratuit pour démarrer) → https://railway.app
3. Une clé **API Groq** (100 % gratuite, sans carte) → https://console.groq.com/keys

---

## ÉTAPE 1 — Mettre le code sur GitHub

### Option A — Avec Git (recommandé)

```bash
# Dans le dossier du projet décompressé :
git init
git add .
git commit -m "Version initiale BTP Chiffrage IA"
git branch -M main
# Créez un dépôt vide sur github.com (sans README), puis :
git remote add origin https://github.com/VOTRE-COMPTE/btp-chiffrage-ia.git
git push -u origin main
```

### Option B — Sans Git (par l'interface web)

1. Sur GitHub, cliquez **New repository** → nommez-le `btp-chiffrage-ia` → **Create**.
2. Cliquez **uploading an existing file**.
3. Glissez-déposez **tout le contenu** du dossier décompressé (pas le dossier `node_modules`).
4. Cliquez **Commit changes**.

---

## ÉTAPE 2 — Créer le projet sur Railway

1. Allez sur https://railway.app → **Login** (connectez-vous avec GitHub).
2. Cliquez **New Project** → **Deploy from GitHub repo**.
3. Autorisez Railway à accéder à vos dépôts, puis sélectionnez **btp-chiffrage-ia**.
4. Railway détecte automatiquement Next.js et lance un premier build (il échouera tant que la base de données et les variables ne sont pas configurées — c'est normal).

---

## ÉTAPE 3 — Ajouter la base de données PostgreSQL

1. Dans votre projet Railway, cliquez **+ New** (ou **Create**) → **Database** → **Add PostgreSQL**.
2. Railway crée la base et génère automatiquement une variable `DATABASE_URL`.
3. **Reliez-la au service de l'application :**
   - Cliquez sur le service de votre application (la carte du dépôt GitHub).
   - Onglet **Variables** → **+ New Variable** → **Add Reference** → choisissez `DATABASE_URL` de la base Postgres.

> 💡 Sur Railway, la référence se note souvent `${{ Postgres.DATABASE_URL }}`.

---

## ÉTAPE 4 — Configurer les variables d'environnement

Dans le service de l'application → onglet **Variables**, ajoutez :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | (référence vers Postgres — étape 3) |
| `NEXTAUTH_SECRET` | Une longue chaîne aléatoire (voir ci-dessous) |
| `NEXTAUTH_URL` | L'URL publique de votre app (voir étape 5) |
| `GROQ_API_KEY` | Votre clé `gsk_...` (gratuite) |
| `GROQ_MODEL` | `openai/gpt-oss-120b` |
| `GROQ_VISION_MODEL` | `qwen/qwen3.6-27b` |

**Générer `NEXTAUTH_SECRET`** (dans un terminal) :
```bash
openssl rand -base64 32
```
Ou utilisez n'importe quelle chaîne longue et aléatoire (≥ 32 caractères).

---

## ÉTAPE 5 — Générer le domaine public

1. Service de l'application → onglet **Settings** → section **Networking** → **Generate Domain**.
2. Railway vous donne une URL du type `https://btp-chiffrage-ia-production.up.railway.app`.
3. **Copiez cette URL** et collez-la dans la variable `NEXTAUTH_URL` (étape 4).
4. Cliquez **Deploy** / **Redeploy** pour appliquer.

---

## ÉTAPE 6 — Créer les tables et les données de départ

Le **schéma de base de données** est créé automatiquement au démarrage (`prisma db push`, voir `railway.json`). Aucune action manuelle nécessaire.

Pour insérer les **comptes de démo et la base de prix**, ouvrez un terminal Railway :

1. Service de l'application → menu **⋮** → **Terminal** (ou installez la CLI Railway).
2. Lancez :
```bash
npm run db:seed
```

> Avec la CLI Railway en local : `railway run npm run db:seed`

✅ **C'est prêt !** Ouvrez votre URL publique. Connectez-vous avec :
- **admin@btp-maroc.ma** / **Admin2026!**

---

## 🔄 Mettre à jour l'application

Chaque `git push` sur la branche `main` redéploie automatiquement Railway.

---

## 🧪 Vérification rapide

1. Connectez-vous → vous arrivez sur le **tableau de bord**.
2. **Appels d'offres** → créez-en un → importez un PDF/Excel de bordereau.
3. Cliquez **🤖 Lancer l'analyse IA complète** (1 à 3 min).
4. Consultez la fiche synthèse, le bordereau chiffré, les risques.
5. Téléchargez l'**Excel** et le **rapport PDF**.

---

## 🆘 Dépannage

| Problème | Solution |
|---|---|
| Build échoue sur Prisma | Vérifiez que `DATABASE_URL` est bien référencée |
| « GROQ_API_KEY non configurée » | Ajoutez la variable, puis redéployez |
| Connexion impossible | Vérifiez `NEXTAUTH_URL` = URL publique exacte (https) et `NEXTAUTH_SECRET` défini |
| Pas de comptes | Lancez `npm run db:seed` dans le terminal Railway |
| PDF scanné non lu | Vérifiez que `ghostscript`+`graphicsmagick` sont bien installés (déjà dans `nixpacks.toml`) |

---

## 🔍 OCR des scans & images — INCLUS

L'OCR fonctionne **out-of-the-box** :
- **Images** (PNG/JPG/photos) → lues directement par le modèle vision Groq.
- **PDF scannés** → rasterisés (ghostscript + graphicsmagick, déjà déclarés dans `nixpacks.toml`) puis lus page par page.

Le parsing texte natif est utilisé en priorité pour les PDF/Word/Excel numériques ; l'OCR ne se déclenche que si peu de texte est détecté (< 80 caractères/page).

## 🗺️ Métré automatique des plans — INCLUS

Importez un document dont le nom contient « plan » (PDF ou image). Pour les **plans PDF vectoriels** (export CAO/AutoCAD,
le cas le plus courant), l'app extrait la **couche texte exacte** (cotes, dimensions, nomenclatures, tableaux de ferraillage,
légendes de surfaces) au pixel près via pdfjs, détecte l'**échelle** (1/100, 1:50…), puis combine ces valeurs fiables à la
lecture vision pour calculer longueurs/surfaces/volumes/béton/acier. Les images/scans sont traités par vision.
Lors de l'analyse, les quantités sont **comparées au DQE** et tout écart ≥ 10 % génère une alerte (onglet « Plans & métré »).

## 🧠 Recherche VECTORIELLE sémantique & apprentissage continu — INCLUS

La recherche utilise de **vrais embeddings sémantiques multilingues**, calculés **localement et gratuitement** (Transformers.js,
modèle `paraphrase-multilingual-MiniLM`) — aucune clé requise. Chaque désignation est vectorisée ; la recherche se fait par
**similarité cosinus**. La base s'**auto-indexe** progressivement (remplissage opportuniste) et s'enrichit à chaque projet.
Bouton **« 🔎 Similarité »** dans la bibliothèque de prix.

**RAM :** le modèle (~70–120 Mo) se télécharge une fois et tourne en CPU. Prévoyez **≥ 1 Go de RAM** sur le service Railway.
Si vous préférez ne rien charger localement, activez l'option **Jina** (gratuite, sans carte) dans les variables :
`EMBEDDINGS_PROVIDER=jina` + `JINA_API_KEY=...`. En dernier recours, le système retombe automatiquement sur `pg_trgm` puis
sur une recherche par mots-clés — il reste donc fonctionnel en toutes circonstances.

---

> Application livrée comme **produit fonctionnel**. Les estimations sont indicatives et doivent être validées par un métreur.
