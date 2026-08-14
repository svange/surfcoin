# Branch protection ruleset

`main-branch-protection.json` is the source of truth for the default-branch
ruleset that CLAUDE.md refers to ("Enforcement lives in a default-branch
ruleset, not just the workflow"). It requires:

- the five PR gate checks as **required status checks** — `Code quality`,
  `Security`, `Compliance`, `Build validation`, `Tests`
  (`strict_required_status_checks_policy: false` — a branch does not have to be
  up to date with `main` to merge);
- **code-owner review** (`.github/CODEOWNERS`) with
  `required_approving_review_count: 0`, stale reviews dismissed on push. This is
  the rule that decides whether a Renovate PR can merge itself — see CLAUDE.md
  › Dependency updates and issue #25;
- no branch deletion and no force-push on `main`.

## Applying it

GitHub does **not** read rulesets from a repo file — this JSON has to be
pushed to the repo via the REST API by someone with admin rights. It cannot
be created from inside a sandboxed CI/agent session (the egress proxy blocks
GitHub API writes), so apply it once from an admin's machine:

```bash
# create (first time)
gh api --method POST repos/svange/surfcoin/rulesets \
  --input .github/rulesets/main-branch-protection.json

# update later: find the ruleset id, then PUT the same file
gh api repos/svange/surfcoin/rulesets --jq '.[] | "\(.id)\t\(.name)"'
gh api --method PUT repos/svange/surfcoin/rulesets/<RULESET_ID> \
  --input .github/rulesets/main-branch-protection.json
```

Verify the required checks match the job names in
`.github/workflows/deploy.yaml` exactly — a renamed job silently stops being
enforced until its `context` here is updated to match.
