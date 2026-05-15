# Concert Data Lineage Explorer

An interactive lineage map from raw source data to final published reports, powered by dbt + ReactFlow.

## Live Demo
🔗 https://jathinewong.github.io/concert-data-lineage-explorer/

## Phases

### ✅ Phase 1 — Dev Environment Setup *(Done)*
- Dev container with Node 22
- Port 5173 auto-forwarded
- `vite.config.ts` with `host: true`

### ✅ Phase 2 — Core Lineage Graph *(Done)*
- Parse `manifest.json` + `catalog.json`
- Interactive DAG with ReactFlow + Dagre
- Node colour-coding (model/seed/source)
- Click node → sidebar with metadata + columns

### ✅ Phase 3 — Search & Filtering *(Done)*
- Fuse.js fuzzy search over model/column names
- Highlight upstream/downstream lineage paths on click
- Filter by node type (models/seeds/sources)

### ✅ Phase 4 — CI/CD & Deployment *(Done)*
- GitHub Pages deployment on push to `main`
- Manual + scheduled dbt artifact refresh workflow

### 🔜 Phase 5 — Live dbt Artifact Pipeline

Connect the nightly dbt build in `concertgenetics/data-warehouse-dbt` to this
repo so the lineage explorer always reflects the latest real data.

#### Background
- The nightly build runs via `build-dw.sh` in `concertgenetics/data-warehouse-dbt`
- It currently does **not** run `dbt docs generate`, so no artifacts are produced
- `manifest.json` and `catalog.json` in `app/public/` are currently static fixtures
- The two repos are in different GitHub orgs (private `concertgenetics` → public `Jathinewong`)

#### Architecture

```
concertgenetics/data-warehouse-dbt          Jathinewong/concert-data-lineage-explorer
─────────────────────────────────           ─────────────────────────────────────────
Nightly build (build-dw.sh):          →     repository_dispatch received:
  1. dbt run (already exists)                 1. write manifest.json → app/public/
  2. dbt docs generate  ← ADD THIS            2. write catalog.json  → app/public/
  3. read target/manifest.json                3. git commit & push to main
  4. read target/catalog.json                 4. Deploy to GitHub Pages fires
  5. send repository_dispatch event           5. Live site updated automatically
     to Jathinewong repo with
     artifacts as base64 payload
```

#### Step-by-Step Implementation Plan

**Step 1 — Add `dbt docs generate` to `build-dw.sh`** *(in `concertgenetics/data-warehouse-dbt`)*
- Append `dbt docs generate` after the existing `dbt run` step in `build-dw.sh`
- This produces `target/manifest.json` and `target/catalog.json`

**Step 2 — Create a PAT (Personal Access Token)**
- Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
- Create a token on the `Jathinewong` account with:
  - Repository access: `Jathinewong/concert-data-lineage-explorer`
  - Permissions: `Contents: Read & Write`, `Actions: Read & Write`
- Store the token as a secret in `concertgenetics/data-warehouse-dbt`:
  - Secret name: `LINEAGE_EXPLORER_PAT`

**Step 3 — Add dispatch workflow to `concertgenetics/data-warehouse-dbt`**
- Create `.github/workflows/publish-lineage-artifacts.yml`
- Triggers after nightly build completes
- Reads `target/manifest.json` and `target/catalog.json`
- Encodes them as base64 and sends a `repository_dispatch` POST to this repo

```yaml
# .github/workflows/publish-lineage-artifacts.yml (concertgenetics/data-warehouse-dbt)
- name: Dispatch lineage artifacts to explorer repo
  run: |
    MANIFEST=$(base64 -w 0 target/manifest.json)
    CATALOG=$(base64 -w 0 target/catalog.json)
    curl -X POST \
      -H "Authorization: Bearer ${{ secrets.LINEAGE_EXPLORER_PAT }}" \
      -H "Accept: application/vnd.github+json" \
      https://api.github.com/repos/Jathinewong/concert-data-lineage-explorer/dispatches \
      -d "{\"event_type\":\"dbt-artifacts-updated\",\"client_payload\":{\"manifest\":\"$MANIFEST\",\"catalog\":\"$CATALOG\"}}"
```

**Step 4 — Update `refresh-lineage.yml` in this repo**
- Add `repository_dispatch` trigger listening for `event_type: dbt-artifacts-updated`
- Decode the base64 `manifest` and `catalog` payloads from `github.event.client_payload`
- Write them to `app/public/manifest.json` and `app/public/catalog.json`
- Commit and push to `main` (deploy workflow fires automatically)

```yaml
# .github/workflows/refresh-lineage.yml (this repo)
on:
  repository_dispatch:
    types: [dbt-artifacts-updated]
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * *'  # daily at 6am UTC (after nightly build completes)

steps:
  - name: Write artifacts from dispatch payload
    run: |
      echo "${{ github.event.client_payload.manifest }}" | base64 -d > app/public/manifest.json
      echo "${{ github.event.client_payload.catalog }}"  | base64 -d > app/public/catalog.json
```

#### Prerequisites Checklist
- [ ] Confirm `dbt docs generate` works locally in `data-warehouse-dbt` dev container
- [ ] Confirm output path is `target/manifest.json` and `target/catalog.json`
- [ ] Create PAT on `Jathinewong` account with correct permissions
- [ ] Add `LINEAGE_EXPLORER_PAT` secret to `concertgenetics/data-warehouse-dbt`
- [ ] Confirm nightly build timing (so schedule cron can be set correctly)
- [ ] Verify `concertgenetics` org allows cross-org `repository_dispatch` calls
