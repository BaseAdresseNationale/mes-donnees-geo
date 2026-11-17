# CLAUDE.md

Outil cartographique pour que les communes éditent leurs données géographiques (voies locales, adresses, limites administratives…) via une architecture **plugin**. Le README détaille le modèle métier de chaque plugin : le lire avant de toucher à un plugin.

## Commandes

```bash
npm install            # npm uniquement (package-lock) ; postinstall génère le client Prisma
cp .env.example .env.local
docker compose up -d   # PostgreSQL 16 + PostGIS
npm run dev            # login ProConnect stubbé en dev
npm run build
npm run lint
npm run typecheck
npx prisma migrate dev --name <changement>   # génère + applique une migration
npm run db:migrate                           # prisma migrate deploy
npm run prisma:generate-client               # régénère src/generated/prisma
npm run generate:api-bal                     # régénère le client mes-adresses-api (openapi-ts)
```

Pas de tests automatisés : valider avec `npm run lint && npm run typecheck`.

## Architecture

Next.js 16 App Router + TypeScript, UI `@gouvfr-lasuite/ui-components` (pas evergreen ni DSFR), MapLibre GL + Terra Draw, TanStack Query, Prisma 7 (ESM, `@prisma/adapter-pg`).

- `src/plugins/` : un dossier par plugin (`voies-locales`, `adresses`, `limites-administratives`), contrat `GeoPlugin` dans `types.ts`, enregistrement dans `registry.ts`.
- `src/app/[codeCommune]/` : pages par commune ; `src/app/api/` : routes REST par plugin ; `src/app/auth/` : ProConnect.
- `src/lib/` : `db/` (repositories Prisma → domaine), `auth/` (session, `requireSession`), `api-bal/` (client mes-adresses-api, `generated/` = généré), `publication/`, `ban/`, `datagouv/`, `export/`, `geo/`, `cron/`.
- `src/components/` : composants par plugin + `map/`, `plugin-workspace/`, `panoramax/`.

## Conventions

- **Base entity** : chaque table métier a `id UUID`, `created_at`, `updated_at`, `deleted_at?`. Suppression = soft-delete (`deleted_at`), toutes les lectures filtrent `deleted_at IS NULL`.
- Géométrie : colonne JSONB source de vérité + colonne PostGIS dérivée maintenue par trigger. Les migrations PostGIS (extensions, `geometry`, triggers) sont écrites **à la main en SQL** dans `prisma/migrations/` — Prisma ne les diff pas.
- Routes API : toujours `requireSession` et scoper au `codeInsee` de la session. La validation métier d'un plugin est partagée client/serveur et ré-appliquée côté serveur.
- Accessibilité RGAA : la carte doit rester utilisable au clavier, avec liste textuelle synchronisée et annonces `aria-live`.
- `no-alert` est une erreur ESLint : utiliser `useModals` de `@gouvfr-lasuite/ui-components`.
- Ne jamais éditer `src/generated/**` ni `src/lib/api-bal/generated/**`.
