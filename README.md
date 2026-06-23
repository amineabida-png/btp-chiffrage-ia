# 🇲🇦 BTP Chiffrage IA — Maroc

Application SaaS d'**intelligence artificielle** pour le **chiffrage automatique des appels d'offres BTP au Maroc** — propulsée par **Groq (100 % gratuit)**.

Importez le BPU, le DQE, le CPS, le CCTP, le RC et les plans → l'IA produit un **dossier d'étude de prix complet** : fiche synthèse, bordereau chiffré, sous-détails, **OCR des scans**, **métré automatique des plans**, analyse des risques, contrôle de cohérence et exports Excel/PDF. En **Dirhams (MAD)**, conforme aux pratiques marocaines (décret n° 2-22-431, TVA 20 %, cautions, qualifications/classifications).

---

## 🚀 Stack technique

| Élément | Technologie |
|---|---|
| Framework full-stack | **Next.js 14** (App Router) |
| Base de données | **PostgreSQL** + Prisma ORM |
| IA (texte + vision) | **Groq** — `openai/gpt-oss-120b` + `qwen/qwen3.6-27b` (gratuit) |
| OCR scans / images | Modèle **vision Groq** + rastérisation (ghostscript/graphicsmagick + sharp) |
| Recherche vectorielle | **Embeddings sémantiques locaux** (Transformers.js multilingue, gratuit, sans clé) + repli pg_trgm |
| Authentification | NextAuth (multi-rôles) |
| Exports | ExcelJS (.xlsx), PDFKit (.pdf) |
| UI | Tailwind CSS (responsive) |

## ✅ Fonctionnalités

- ✅ Import multi-documents (PDF, Word, Excel, **images & scans**)
- ✅ **OCR intelligent** : PDF scannés, photos, images → texte + tableaux (numéro, désignation, unité, quantité)
- ✅ Analyse automatique du marché (fiche synthèse complète)
- ✅ Extraction des articles + **chiffrage IA** (déboursé sec → frais chantier → frais généraux → aléas → marge → prix de vente)
- ✅ **Coefficients personnalisables**
- ✅ **Métré automatique des plans** : lecture de la **couche texte vectorielle exacte** (cotes, nomenclatures, tableaux de ferraillage) + vision, détection d'échelle, **comparaison avec le DQE et alertes d'écart**
- ✅ **Recherche vectorielle sémantique & apprentissage continu** : embeddings multilingues (gratuits, locaux) ; la base s'enrichit et s'auto-indexe à chaque projet pour assister les chiffrages suivants
- ✅ Analyse des risques (score global + 5 catégories) + recommandations
- ✅ Contrôle de cohérence & alertes
- ✅ Base de prix Maroc (10 corps d'état, en MAD)
- ✅ Exports : bordereau chiffré Excel, sous-détails, conditions du marché, rapport PDF
- ✅ Tableau de bord + multi-utilisateurs (Admin, Directeur, Métreur, Chargé d'étude, Consultation)

## 🏁 Démarrage rapide (local)

```bash
npm install
cp .env.example .env        # renseignez GROQ_API_KEY et les autres variables
npx prisma db push          # crée les tables + extension pg_trgm
npm run db:seed             # données + comptes de démo
npm run dev                 # http://localhost:3000
```

> Pour l'OCR des **PDF scannés** en local, installez `ghostscript` et `graphicsmagick` (ex. macOS : `brew install ghostscript graphicsmagick`). Les **images** fonctionnent sans rien installer.

**Compte de démo :** `admin@btp-maroc.ma` / `Admin2026!`

## 🔑 Obtenir une clé Groq (gratuite)

1. Allez sur https://console.groq.com → créez un compte.
2. Rubrique **API Keys** → **Create API Key** → copiez la clé `gsk_...`.
3. Collez-la dans `GROQ_API_KEY`. Aucune carte bancaire requise.

## 📦 Déploiement

👉 Suivez **[`DEPLOYMENT.md`](./DEPLOYMENT.md)** (GitHub + Railway, pas-à-pas).

---

> 💡 Recherche **100 % sémantique sans clé** : au premier démarrage, le modèle d'embeddings (~70–120 Mo) se télécharge une fois et s'exécute localement. Prévoyez **≥ 1 Go de RAM** sur Railway (sinon basculez sur l'option Jina gratuite, voir `.env.example`). Le système reste fonctionnel même si les embeddings sont indisponibles (repli automatique).
>
> ⚠️ Comme tout outil d'estimation professionnel, les chiffrages et métrés sont à **valider par un métreur** avant soumission.
