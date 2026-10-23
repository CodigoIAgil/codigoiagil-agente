#!/usr/bin/env bash
# Aplica as proteções padrão a um repositório público no GitHub.
# Uso (Git Bash):  bash scripts/proteger-repo.sh CodigoIAgil/nome-do-repo
# Pode rodar mais de uma vez: atualiza o que já existe.
set -euo pipefail

REPO="${1:?Informe o repositório no formato dono/nome}"
RULESET_NAME="protege-main"

echo "==> Configurações de merge (só squash, apagar a branch depois do merge)"
gh api -X PATCH "repos/$REPO" --silent \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true -F allow_auto_merge=false \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY

echo "==> Secret scanning + push protection"
gh api -X PATCH "repos/$REPO" --silent --input - <<'JSON'
{"security_and_analysis": {
  "secret_scanning": {"status": "enabled"},
  "secret_scanning_push_protection": {"status": "enabled"}
}}
JSON

echo "==> Dependabot (alertas + atualizações de segurança) e reporte privado de vulnerabilidade"
gh api -X PUT "repos/$REPO/vulnerability-alerts" --silent
gh api -X PUT "repos/$REPO/automated-security-fixes" --silent
gh api -X PUT "repos/$REPO/private-vulnerability-reporting" --silent

echo "==> Ruleset da main ($RULESET_NAME)"
# integration_id 15368 = GitHub Actions: o check `ci` só vale se vier do Actions.
RULESET=$(cat <<'JSON'
{
  "name": "protege-main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH"], "exclude": []}},
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {"type": "required_linear_history"},
    {"type": "pull_request", "parameters": {
      "required_approving_review_count": 0,
      "dismiss_stale_reviews_on_push": true,
      "require_code_owner_review": false,
      "require_last_push_approval": false,
      "required_review_thread_resolution": true,
      "allowed_merge_methods": ["squash"]
    }},
    {"type": "required_status_checks", "parameters": {
      "strict_required_status_checks_policy": true,
      "do_not_enforce_on_create": false,
      "required_status_checks": [{"context": "ci", "integration_id": 15368}]
    }}
  ]
}
JSON
)
EXISTING_ID=$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name==\"$RULESET_NAME\") | .id")
if [ -n "$EXISTING_ID" ]; then
  echo "$RULESET" | gh api -X PUT "repos/$REPO/rulesets/$EXISTING_ID" --silent --input -
else
  echo "$RULESET" | gh api -X POST "repos/$REPO/rulesets" --silent --input -
fi

echo "==> Verificação"
gh api "repos/$REPO" --jq '"squash=\(.allow_squash_merge) merge=\(.allow_merge_commit) rebase=\(.allow_rebase_merge) delete_branch=\(.delete_branch_on_merge)\nsecret_scanning=\(.security_and_analysis.secret_scanning.status) push_protection=\(.security_and_analysis.secret_scanning_push_protection.status)"'
gh api "repos/$REPO/rulesets" --jq '.[] | "ruleset: \(.name) (\(.enforcement))"'
echo "PRONTO: $REPO protegido."
