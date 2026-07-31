#!/usr/bin/env bash
# Sync the committed environment configuration to GitHub Actions.
#
# Reads the operator's filled-in `.env` and pushes each value to GitHub as an
# Actions variable or secret, using `.env.example` as the authoritative list of
# names and their classification. This is the "apply" half of the committed
# config source described in docs/environment-config.md — run it (or re-run it)
# whenever a value changes so the deployed config converges from the repo
# instead of drifting by hand in the GitHub UI.
#
# SAFE BY DEFAULT: this is a DRY RUN unless you pass --apply. A dry run reads
# nothing sensitive and writes nothing.
#
# Usage:
#   npm run sync:env               # dry run — show what would be set
#   npm run sync:env -- --apply    # actually push values to GitHub
#   bash scripts/sync-env.sh --apply --env production   # scope to an environment
#
# Options:
#   --apply              Push values (default is a dry run).
#   --env <name>         Target a GitHub *environment*'s vars/secrets instead of
#                        the repo-level ones (repo-level is the default and is
#                        what deploy.yaml currently reads).
#   --file <path>        Values file (default: .env).
#   --template <path>    Name/classification source (default: .env.example).
#   --repo <owner/name>  Target repo (default: inferred from the git remote).
#   -h, --help           Show this help.
#
# Requires the GitHub CLI (`gh`) authenticated with access to the repo. Install:
# https://cli.github.com/ — then `gh auth login`.
set -euo pipefail

cd "$(dirname "$0")/.."

APPLY=0
ENV_NAME=""
FILE=".env"
TEMPLATE=".env.example"
REPO=""

die() { echo "error: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --env) ENV_NAME="${2:-}"; shift; [ -n "$ENV_NAME" ] || die "--env needs a value" ;;
    --file) FILE="${2:-}"; shift; [ -n "$FILE" ] || die "--file needs a value" ;;
    --template) TEMPLATE="${2:-}"; shift; [ -n "$TEMPLATE" ] || die "--template needs a value" ;;
    --repo) REPO="${2:-}"; shift; [ -n "$REPO" ] || die "--repo needs a value" ;;
    -h|--help) awk 'NR>=2 && /^#/ {sub(/^# ?/,""); print; next} NR>=2 {exit}' "$0"; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

[ -f "$TEMPLATE" ] || die "template '$TEMPLATE' not found (run from the repo root)"
if [ ! -f "$FILE" ]; then
  die "values file '$FILE' not found. Copy the template first: cp $TEMPLATE $FILE"
fi

# gh scope flags: repo-level by default, or an environment when --env is given.
gh_target=()
[ -n "$REPO" ] && gh_target+=(--repo "$REPO")
env_flag=()
[ -n "$ENV_NAME" ] && env_flag+=(--env "$ENV_NAME")

# Read one value out of the values file. Last assignment wins; strips an
# optional trailing CR (CRLF files) and one layer of surrounding quotes.
env_value() {
  local name="$1" val
  val="$(grep -E "^[[:space:]]*${name}=" "$FILE" 2>/dev/null | tail -n1 || true)"
  [ -n "$val" ] || { printf ''; return 0; }
  val="${val#*=}"
  val="${val%$'\r'}"
  case "$val" in
    \"*\") val="${val#\"}"; val="${val%\"}" ;;
    \'*\') val="${val#\'}"; val="${val%\'}" ;;
  esac
  printf '%s' "$val"
}

# Parse the template for the canonical name list and which names are secrets.
NAMES=""
SECRETS=" " # space-delimited membership set: " NAME1 NAME2 "
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  case "$line" in
    ''|'#'*) continue ;;
  esac
  case "$line" in
    *=*) : ;;
    *) continue ;;
  esac
  name="${line%%=*}"
  name="$(printf '%s' "$name" | tr -d '[:space:]')"
  [ -n "$name" ] || continue
  NAMES="$NAMES $name"
  case "$line" in
    *"@secret"*) SECRETS="$SECRETS$name " ;;
  esac
done < "$TEMPLATE"

is_secret() { case "$SECRETS" in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

scope_desc="repo-level"
[ -n "$ENV_NAME" ] && scope_desc="environment '$ENV_NAME'"
if [ "$APPLY" -eq 1 ]; then
  command -v gh >/dev/null 2>&1 || die "the GitHub CLI (gh) is required for --apply — https://cli.github.com/"
  gh auth status >/dev/null 2>&1 || die "gh is not authenticated — run: gh auth login"
  echo "==> Syncing $scope_desc GitHub config from '$FILE'"
else
  echo "==> DRY RUN (no changes) — syncing $scope_desc config from '$FILE'"
  echo "    re-run with --apply to push these values to GitHub."
fi
echo

set_count=0
skip_count=0
for name in $NAMES; do
  value="$(env_value "$name")"
  if [ -z "$value" ]; then
    if is_secret "$name"; then kind="secret"; else kind="variable"; fi
    echo "  skip   $kind $name (unset in $FILE)"
    skip_count=$((skip_count + 1))
    continue
  fi
  if is_secret "$name"; then
    if [ "$APPLY" -eq 1 ]; then
      printf '%s' "$value" | gh secret set "$name" "${gh_target[@]}" "${env_flag[@]}" --body - >/dev/null
      echo "  set    secret   $name = ******"
    else
      echo "  would  secret   $name = ******"
    fi
  else
    if [ "$APPLY" -eq 1 ]; then
      gh variable set "$name" "${gh_target[@]}" "${env_flag[@]}" --body "$value" >/dev/null
      echo "  set    variable $name = $value"
    else
      echo "  would  variable $name = $value"
    fi
  fi
  set_count=$((set_count + 1))
done

# Flag drift: values present in .env that the template does not enumerate. These
# are NOT synced — add them to .env.example (under review) if the pipeline needs
# them, or remove them from .env.
extras=""
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  case "$line" in ''|'#'*) continue ;; esac
  case "$line" in *=*) : ;; *) continue ;; esac
  k="${line%%=*}"; k="$(printf '%s' "$k" | tr -d '[:space:]')"
  [ -n "$k" ] || continue
  case " $NAMES " in *" $k "*) : ;; *) extras="$extras $k" ;; esac
done < "$FILE"
if [ -n "$extras" ]; then
  echo
  echo "  note: these keys in $FILE are NOT in $TEMPLATE and were ignored:$extras"
  echo "        add them to $TEMPLATE (committed, reviewed) if the pipeline needs them."
fi

echo
if [ "$APPLY" -eq 1 ]; then
  echo "==> Done. $set_count set, $skip_count skipped."
else
  echo "==> Dry run complete. $set_count would be set, $skip_count skipped. Nothing was changed."
fi
