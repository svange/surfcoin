# surfcoin.fail — $SURF

[![CI/CD Pipeline](https://github.com/svange/surfcoin/actions/workflows/deploy.yaml/badge.svg)](https://github.com/svange/surfcoin/actions/workflows/deploy.yaml)
[![Release](https://img.shields.io/github/v/release/svange/surfcoin?sort=semver&label=release)](https://github.com/svange/surfcoin/releases)

> Surf's up. Expectations down.

**What this is.** The marketing site *and* playground for **$SURF**, a Solana
memecoin on pump.fun. The public site (`/`, `/coins`) is a single-page app with
a 70s surf-poster aesthetic, deadpan copy, and honest tokenomics; a members-only
**playground** (`/playground`, "The Shaping Bay") drives the pump.fun API from a
safe, dry-run-by-default cockpit. Built to run entirely pre-launch and flip to
"live" the moment the coin exists — by changing exactly one value.

**Stack.** Vite + React 19 + Tailwind v4 + TypeScript SPA, plus one Node 22
Lambda backend (`backend/`). Shipped as a single **AWS SAM** stack — S3 +
CloudFront for the site, API Gateway (HTTP API) + DynamoDB + KMS + Cognito for
the playground — to `us-east-1` by the GitHub Actions pipeline.

---

## Orientation

### Pipeline & artifacts

CI/CD is one workflow: [`.github/workflows/deploy.yaml`](.github/workflows/deploy.yaml)
(“CI/CD Pipeline”). PR runs are the merge gates; deploy, e2e, smoke, and release
run only on push to `main`. Live status: the badge above → the
[Actions page](https://github.com/svange/surfcoin/actions/workflows/deploy.yaml).

| Artifact | Produced by | Where to find it |
| --- | --- | --- |
| **Releases + changelog** | `release` job (`semantic-release`), each push to `main` | <https://github.com/svange/surfcoin/releases> (latest `v1.0.0`) |
| **Browser e2e report** — Playwright, video always + trace on failure | `e2e` job, post-deploy | GitHub Pages mirror <https://svange.github.io/surfcoin/> (live; refreshed by every `main` deploy); per-run `playwright-report` artifact on the [run page](https://github.com/svange/surfcoin/actions/workflows/deploy.yaml) |
| **Unit tests + coverage** | `test` job (`vitest --coverage`) | Coverage report on GitHub Pages <https://svange.github.io/surfcoin/unit/> (live; refreshed by every `main` deploy); JUnit + lcov in the per-run `unit-test-report` artifact on the [run page](https://github.com/svange/surfcoin/actions/workflows/deploy.yaml) |

### Documentation

| Doc | What it covers |
| --- | --- |
| [`README.md`](README.md) | This file — orientation, local dev, launch, deploy, testing. |
| [`CLAUDE.md`](CLAUDE.md) | Agent/contributor working notes: architecture invariants, CI gates, ship workflow. |
| [`docs/playground-design.md`](docs/playground-design.md) | The Shaping Bay: architecture, security stance, DynamoDB layout, API routes. |
| [`docs/environment-config.md`](docs/environment-config.md) | Environment config model: the committed `.env.example` source + `npm run sync:env`, and which values are retrieved dynamically in-pipeline. |
| [`.github/.ai-compliance.yaml`](.github/.ai-compliance.yaml) | Per-repo compliance overrides + documented, dated exceptions. |

### Branches & environments

Single-environment project: `main` deploys straight to production. A `dev`
branch exists for integration work, but there is no separate staging deploy
target.

| Ref | CI that runs | Deploys to |
| --- | --- | --- |
| PR → `main` | Merge gates — Code quality, Security, Compliance, Build validation, Tests (all required checks + code-owner review) | — (no deploy) |
| `main` (push) | Gates → `sam deploy` → publish SPA → post-deploy e2e + smoke tests → `semantic-release` | **production** — <https://surfcoin.fail> (alias `surfcoin.aillc.link`) |
| `dev` | No pipeline trigger of its own — open a PR to `main` to run the gates | — (integration only) |

---

## Local development

```bash
npm install
npm run dev      # http://localhost:5173  (in this container: http://localhost:28120)
```

Other scripts:

```bash
npm run build    # type-check + production build into dist/
npm run preview  # serve the built dist/ locally
```

---

## Launch day — the one thing you change

Everything that depends on the coin being live reads from **`src/config.ts`**.
Pre-launch, `contractAddress` is `null` and the site shows its pre-launch state
(CA bar says "drops here at launch", buy button is asleep, stats are the joke
placeholders).

The moment your coin exists on pump.fun:

1. Open `src/config.ts`.
2. Set `contractAddress` to your Solana mint address.
3. (Optional) Fill in `links.twitter` / `links.telegram` when those exist.
4. `npm run deploy`.

That flips the whole site live automatically:

- CA bar shows the real address with a working copy button.
- Buy buttons link to `https://pump.fun/coin/<mint>`.
- The Surf Report polls the **DexScreener public API** every 30s for live
  price / market cap / volume (and links to the full chart). Note: DexScreener
  only has data *after* the coin graduates off the bonding curve to Raydium —
  until then the section shows a "still on the bonding curve" message, which is
  expected and honest.

No other code changes are needed for launch.

### Why there's no contract address in the OG image

X and Telegram cache link unfurls aggressively. If the CA were baked into
`og.png`, a stale/placeholder value could stick around after launch. The social
card intentionally shows only the tagline + domain.

---

## Deploying to AWS (gitops)

The whole app — static site **and** playground backend — is one SAM stack
(`template.yaml`), deployed in `us-east-1` by the GitHub Actions pipeline
(`.github/workflows/deploy.yaml`). There is no manual `aws cloudformation deploy`
anymore.

- **Open a PR** → the pipeline runs code-quality, security (gitleaks, semgrep,
  dependency audit via `audit-ci`) and build-validation (`sam validate` +
  frontend/backend builds).
- **Merge to `main`** → the `deploy` job assumes the repo-scoped OIDC role
  (`surfcoin-deploy`), runs `sam deploy`, then builds the SPA against the fresh
  stack outputs and publishes it to the site bucket (hashed assets cached
  forever, `index.html` never cached), and invalidates CloudFront. Then
  smoke-tests hit the live site.

Config converges from a **committed source of truth**:
[`.env.example`](.env.example) enumerates every operator-managed GitHub variable
and secret the pipeline reads (`AWS_DEPLOY_ROLE_ARN`, `CFN_EXEC_ROLE_ARN`,
`ARTIFACTS_BUCKET`, `STACK_NAME`, `AWS_REGION`, `DOMAIN_NAME`,
`FAIL_HOSTED_ZONE_ID`, `COGNITO_DOMAIN_PREFIX`, and the optional `GH_TOKEN`).
Fill in a gitignored `.env` and push the values with `npm run sync:env -- --apply`
instead of hand-editing them in the GitHub UI. No AWS keys are stored, and
dynamic values (Cognito ids, site bucket, CloudFront distribution id) are
retrieved from stack outputs in-pipeline — see
[`docs/environment-config.md`](docs/environment-config.md). Deploys are gated on
the `production` environment.

All infra changes go through this flow — edit `template.yaml`, open a PR, merge.

### Local iteration (no deploy)

```bash
npm run build            # type-check + build the SPA
npm run build:backend    # esbuild-bundle the Lambda into backend/dist/
sam validate --lint      # validate the template
```

If you ever need to publish the frontend by hand against the live stack:
`AWS_PROFILE=sandbox npm run publish:frontend`.

---

## Tests & CI evidence

Every PR runs the merge gates: type-check + **lint** (ESLint), **security**
(dependency audit, gitleaks, semgrep), **license** compliance, **build
validation**, and **unit tests with an enforced coverage threshold**. These are
required status checks on `main` (plus code-owner review), so nothing merges
un-gated.

```bash
npm run lint            # ESLint static analysis
npm test               # vitest unit tests
npm run test:coverage  # vitest + coverage (thresholds fail the run)
npm run audit:ci       # enforced high+ dependency audit
npm run test:e2e       # Playwright e2e (set SITE_URL for a remote target)
```

**Browser e2e evidence.** After each deploy to `main`, Playwright runs against
the live site and records a replayable report (video always, trace on failure),
uploaded as the `playwright-report` workflow artifact. The pipeline also mirrors
it to GitHub Pages at <https://svange.github.io/surfcoin/> — the mirror is live
and refreshed by every `main` deploy. For a specific historical run, grab the
`playwright-report` artifact from that run's page. See the
[Pipeline & artifacts](#pipeline--artifacts) table above.

---

## The Shaping Bay — pump.fun API playground

`/playground` is a members-only sandbox for driving the pump.fun API in a safe,
dry-run-by-default environment. Sign up with email (AWS Cognito), then:

- **Link a Solana wallet** — one-button connect + message-signature handshake
  (read-only; signing here never spends). Used to show your holdings and created
  coins.
- **Link a PumpPortal Lightning key** — this is what actually authorizes trades.
  Stored KMS-encrypted, never returned to the browser. pump.fun has no OAuth, so
  this key (from [pumpportal.fun](https://pumpportal.fun)) is how programmatic
  trading works.
- **Trade desk** — pick any coin, see a live candlestick chart + recent trades,
  and place manual buys/sells (Lightning-key execution *or* local browser-wallet
  signing) with full control of amount, slippage, priority fee, and pool.
- **King of the Hill** — a bonding-curve calculator (the shared pump.fun curve:
  30 virtual SOL + 1,073,000,191 tokens, constant-product, graduating at 85 SOL)
  that quotes tokens/price/impact/market-cap for any buy or sell, plus a live
  tracker of *your* coins (Created + pinned mints): how far each is from the
  ~$30k KOTH market cap and how much SOL a buy needs to push it there. **Push to
  KOTH** prefills that buy straight into the trade desk. Curve math lives in
  `src/lib/bondingCurve.ts`.
- **Autopilot** — price/market-cap trigger rules ("buy 0.1 SOL when mcap falls to
  $X") evaluated once a minute by an EventBridge tick.
- **API explorer** — raw GET passthrough to the pump.fun data hosts, host-locked
  and path-validated, so you can see everything the API exposes.

### The master safety gate

Nothing moves real SOL while **`liveTrading` is off** (the default). Lightning
trades, fee claims, and autopilot rules downgrade to dry runs that echo the
exact upstream request without sending it; wallet-signed trades are refused
outright (they have no dry-run form). Arming LIVE plus a linked Lightning key
enables Lightning/autopilot execution; arming LIVE plus a linked wallet enables
wallet-signed orders. The toggles live under **Connections → Safety**.

### Backend architecture

A single Node 22 Lambda (`backend/`) behind an API Gateway HTTP API with a
**Cognito JWT authorizer**. State lives in one DynamoDB table keyed by
`USER#<sub>`; linked credentials are encrypted with a dedicated KMS key. All
pump.fun data is proxied through the Lambda because pump.fun's APIs reject
cross-origin browser calls (Cloudflare 403s any request carrying an `Origin`).
The shared request/response contract is `shared/types.ts`, imported by both the
SPA and the Lambda.

The backend is part of the single SAM stack (see **Deploying to AWS** above) —
the pipeline builds and ships it on every merge to `main`.

The frontend reads its Cognito/API identifiers from `src/playground/runtime.ts`
(public values, safe to ship). The pipeline regenerates that file from the stack
outputs before each build; to refresh it locally run
`AWS_PROFILE=sandbox bash scripts/sync-playground-config.sh`.

See [`docs/playground-design.md`](docs/playground-design.md) for the full
architecture, security stance, DynamoDB layout, and API-route reference.

## Project layout

```
index.html            # meta tags, fonts, OG/social card
shared/types.ts       # API contract shared by SPA + Lambda
src/
  config.ts           # LAUNCH-DAY CONTROL PANEL — CA, socials, supply
  App.tsx             # marketing site section composition
  main.tsx            # router: / (site) and /playground (code-split)
  components/         # Hero, SurfReport, Wavenomics, TideChart, Lifeguard, ...
  playground/         # auth (PKCE), wallet link, coins, chart, trade, autopilot
  hooks/              # useMarketData (DexScreener), useInView
  lib/                # formatting, palette, toast
backend/src/          # Lambda: router, db, pump.fun client, pumpportal, solana, autopilot
public/               # favicon.svg, og.png, robots.txt
template.yaml         # ONE SAM stack: site (S3/CloudFront/ACM/Route53) + backend
samconfig.toml        # SAM deploy defaults
.env.example          # committed template for pipeline vars/secrets (npm run sync:env)
.github/workflows/
  deploy.yaml         # CI/CD: checks → sam deploy (OIDC) → publish SPA → smoke
  maintenance.yaml    # scheduled health check → auto-triaged incident issues
scripts/
  publish-frontend.sh          # build SPA from stack outputs → sync → invalidate
  sync-playground-config.sh    # write runtime.ts from stack outputs
  sync-env.sh                  # push committed env config (.env) to GitHub vars/secrets
```

---

## Notes

- All motion respects `prefers-reduced-motion`.
- Tokenomics claims (1B supply, 0 tax, no presale, LP burned on graduation,
  mint via bonding curve) are true for any standard pump.fun launch, so the
  Wavenomics section is accurate as written — keep it that way.
- This is a memecoin site. The footer disclaimer is real; leave it in.
