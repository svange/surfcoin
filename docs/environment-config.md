# Environment configuration

The CI/CD pipeline needs a handful of account-specific values to deploy
(`.github/workflows/deploy.yaml`). Rather than clicking them into the GitHub UI
one at a time — where they drift, go undocumented, and can't be reviewed — this
repo keeps environment config **converging from a committed source**. There are
three tiers, and every value lives in exactly one of them.

## The three tiers

| Tier | Lives in | Examples | How it reaches the pipeline |
| --- | --- | --- | --- |
| **Constants** | committed (`samconfig.toml`, workflow `env:`) | node version | read straight from the repo |
| **Static config** | committed **template** (`.env.example`) → synced to GitHub | deploy role ARN, hosted-zone id, domain, Cognito prefix, `GH_TOKEN` | operator fills `.env`, runs `npm run sync:env` → the pipeline reads `${{ vars.* }}` / `${{ secrets.* }}` |
| **Dynamic values** | not stored anywhere | CloudFront distribution id, site bucket, Cognito user-pool / client / domain ids, API endpoint, `SiteUrl` | **retrieved in-pipeline** from CloudFormation stack outputs |

The rule of thumb: if a value is **produced by a deploy**, it is dynamic — never
hand-store it; retrieve it. If it is **chosen by the operator/account** and can't
be derived, it is static — enumerate it in `.env.example` and sync it. Keep the
static set small enough to hold in your head.

### Why dynamic values are never stored

The playground's Cognito/API identifiers and the CloudFront/S3 targets change
every time the stack is (re)created. Storing them would guarantee drift, so the
pipeline reads them back from the stack after `sam deploy`:

- [`scripts/sync-playground-config.sh`](../scripts/sync-playground-config.sh)
  writes `src/playground/runtime.ts` from the stack outputs.
- [`scripts/publish-frontend.sh`](../scripts/publish-frontend.sh) reads the site
  bucket + distribution id from the stack outputs to publish and invalidate.

## The committed source of truth

[`.env.example`](../.env.example) is the single committed enumeration of every
operator-managed GitHub Actions **variable** and **secret** the pipeline reads.
It lists names + placeholder values only — never real values. A line marked
`# @secret` is synced as a GitHub *secret*; everything else as a *variable*.

`.env` (the operator's filled-in copy) is **gitignored** and must never be
committed — both a pre-commit hook (`forbid-env-commit`) and `gitleaks` block
it.

## Applying config (operator)

You need the [GitHub CLI](https://cli.github.com/) authenticated against the
repo (`gh auth login`).

```bash
cp .env.example .env        # then fill in the values for your AWS account
npm run sync:env            # DRY RUN — prints exactly what would change
npm run sync:env -- --apply # push the values to GitHub (variables + secrets)
```

- **Dry run is the default** — nothing is written until you pass `--apply`.
- Re-run it any time a value changes; it's idempotent (it overwrites in place).
- Secret values are masked in the output; variable values are printed (they're
  not sensitive — ARNs, region, domain).
- Keys in `.env` that aren't in `.env.example` are reported and **ignored** — so
  a new variable can't sneak into the deployment without first being added to
  the committed template (and thereby reviewed).

By default the sync targets **repo-level** variables/secrets, which is what
`deploy.yaml` reads today (the `deploy` job runs in the `production` GitHub
environment, which inherits repo-level config; the `release` job's `GH_TOKEN`
must be repo-level). To scope to a specific GitHub environment instead:

```bash
npm run sync:env -- --apply --env production
```

## The managed names

`.env.example` is authoritative; this table is the human-readable gloss.

| Name | Kind | What it is |
| --- | --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | variable | OIDC role the pipeline assumes (`surfcoin-deploy`) |
| `CFN_EXEC_ROLE_ARN` | variable | CloudFormation execution role passed to `sam deploy --role-arn` |
| `ARTIFACTS_BUCKET` | variable | S3 bucket SAM uploads packaged artifacts to |
| `STACK_NAME` | variable | CloudFormation stack name (mirrors `samconfig.toml`) |
| `AWS_REGION` | variable | Deploy region (mirrors `samconfig.toml`) |
| `DOMAIN_NAME` | variable | Apex domain for the site + ACM cert |
| `FAIL_HOSTED_ZONE_ID` | variable | Route53 hosted-zone id for `DOMAIN_NAME` |
| `COGNITO_DOMAIN_PREFIX` | variable | Cognito Hosted-UI domain prefix |
| `GH_TOKEN` | secret | *Optional* PAT for `semantic-release`; falls back to `GITHUB_TOKEN` |

`GITHUB_TOKEN` is **not** listed — GitHub injects it into every workflow run
automatically.
