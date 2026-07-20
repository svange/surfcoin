# surfcoin.fail — $SURF

> Surf's up. Expectations down.

A single-page static site for $SURF, a Solana memecoin launching on pump.fun.
70s surf-poster aesthetic, deadpan self-aware copy, honest tokenomics. Built to
run entirely pre-launch and flip to "live" the moment the coin exists — by
changing exactly one value.

Stack: **Vite + React 19 + Tailwind v4 + TypeScript**. No backend. Deploys to
**AWS S3 + CloudFront**.

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

## Deploying to AWS

The site is a private S3 bucket served through CloudFront (Origin Access
Control), with an ACM cert and optional Route53 records. Everything is in
`infra/stack.yaml`. **Deploy in `us-east-1`** — CloudFront requires its
certificate there.

### 1. One-time: create the infrastructure

```bash
# Route53-managed DNS (recommended): pass your hosted zone ID so the cert
# validates and DNS records are created automatically.
aws cloudformation deploy \
  --stack-name surfcoin-site \
  --region us-east-1 \
  --template-file infra/stack.yaml \
  --parameter-overrides DomainName=surfcoin.fail HostedZoneId=<YOUR_ZONE_ID>
```

If the domain's DNS is **not** on Route53 yet, omit `HostedZoneId`. The stack
then skips DNS records; you must (a) add the ACM validation CNAME shown in the
ACM console, and (b) point `surfcoin.fail` at the CloudFront domain
(`DistributionDomainName` output) yourself.

The `aws cloudformation deploy` command blocks until the stack is ready
(the ACM cert won't finish validating until DNS is in place).

### 2. Every deploy after that

```bash
npm run deploy
```

This builds, syncs `dist/` to the bucket (hashed assets cached forever,
`index.html` never cached so launch-day changes appear instantly), and
invalidates CloudFront. Override defaults with env vars if needed:

```bash
STACK_NAME=surfcoin-site AWS_REGION=us-east-1 npm run deploy
```

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
- **Autopilot** — price/market-cap trigger rules ("buy 0.1 SOL when mcap falls to
  $X") evaluated once a minute by an EventBridge tick.
- **API explorer** — raw GET passthrough to the pump.fun data hosts, host-locked
  and path-validated, so you can see everything the API exposes.

### Two safety gates (both required for a real order)

Nothing executes for real unless **`liveTrading` is armed** *and* **a Lightning
key is linked**. Otherwise every trade — manual and rule-driven — runs as a dry
run that echoes the exact upstream request without sending it. Both toggles live
under **Connections → Safety**.

### Backend architecture

A single Node 22 Lambda (`backend/`) behind an API Gateway HTTP API with a
**Cognito JWT authorizer**. State lives in one DynamoDB table keyed by
`USER#<sub>`; linked credentials are encrypted with a dedicated KMS key. All
pump.fun data is proxied through the Lambda because pump.fun's APIs reject
cross-origin browser calls (Cloudflare 403s any request carrying an `Origin`).
The shared request/response contract is `shared/types.ts`, imported by both the
SPA and the Lambda.

```bash
# Deploy the playground backend (stack if changed, then bundle + push Lambda,
# then regenerate src/playground/runtime.ts from stack outputs):
AWS_PROFILE=sandbox bash scripts/deploy-playground.sh
```

The frontend reads its Cognito/API identifiers from `src/playground/runtime.ts`
(public values, safe to ship). Regenerate them any time with
`AWS_PROFILE=sandbox bash scripts/sync-playground-config.sh`.

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
infra/
  stack.yaml          # static site: CloudFront + S3 + ACM + Route53
  playground.yaml     # Cognito + DynamoDB + KMS + Lambda + HTTP API + tick
scripts/
  deploy.sh                    # site: build → sync → invalidate
  deploy-playground.sh         # backend: stack → bundle → update Lambda
  sync-playground-config.sh    # write runtime.ts from stack outputs
```

---

## Notes

- All motion respects `prefers-reduced-motion`.
- Tokenomics claims (1B supply, 0 tax, no presale, LP burned on graduation,
  mint via bonding curve) are true for any standard pump.fun launch, so the
  Wavenomics section is accurate as written — keep it that way.
- This is a memecoin site. The footer disclaimer is real; leave it in.
