#!/usr/bin/env bash
# One-shot setup: Codex auth/config + shell env for Anbalu API gateway.
#
# Usage:
#   bash scripts/setup-codex-anbalu.sh
#   OPENAI_API_KEY=sk-... bash scripts/setup-codex-anbalu.sh
#   bash scripts/setup-codex-anbalu.sh --api-key sk-... --base-url https://api.anbalu.top/v1

set -euo pipefail

# Built-in defaults (not overridden by shell env from ~/.config/omgt/env).
DEFAULT_API_KEY="sk-6ae5e298df622d513e7011eef455edcb593bf63a3f6d2791a148968b99121fde"
DEFAULT_BASE_URL="https://api.anbalu.top/v1"
DEFAULT_MODEL="gpt-5.5"
DEFAULT_REASONING="medium"

OPENAI_API_KEY="$DEFAULT_API_KEY"
OPENAI_BASE_URL="$DEFAULT_BASE_URL"
CODEX_MODEL="$DEFAULT_MODEL"
CODEX_REASONING="$DEFAULT_REASONING"
USE_SHELL_ENV=0

CODEX_DIR="${HOME}/.codex"
OMGT_ENV="${HOME}/.config/omgt/env"
ZSHRC="${HOME}/.zshrc"
ZSHRC_MARKER="# Omgt API (Codex / OpenAI-compatible clients)"

AUTH_JSON="${CODEX_DIR}/auth.json"
CONFIG_TOML="${CODEX_DIR}/config.toml"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SKIP_TEST=0

usage() {
  cat <<'EOF'
Setup Codex + Anbalu API on this machine.

Options:
  --api-key KEY       Override OPENAI_API_KEY
  --base-url URL      Override OPENAI_BASE_URL (default: https://api.anbalu.top/v1)
  --model NAME        Codex model in config.toml (default: gpt-5.5)
  --reasoning LEVEL   model_reasoning_effort (default: medium)
  --skip-test         Skip curl connectivity check
  --from-env          Use OPENAI_* from current shell instead of built-in defaults
  -h, --help          Show this help

By default uses built-in Anbalu defaults (ignores existing shell env).
Pass --from-env to reuse OPENAI_API_KEY / OPENAI_BASE_URL from the environment.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key)
      OPENAI_API_KEY="${2:?missing value for --api-key}"
      shift 2
      ;;
    --base-url)
      OPENAI_BASE_URL="${2:?missing value for --base-url}"
      shift 2
      ;;
    --model)
      CODEX_MODEL="${2:?missing value for --model}"
      shift 2
      ;;
    --reasoning)
      CODEX_REASONING="${2:?missing value for --reasoning}"
      shift 2
      ;;
    --skip-test)
      SKIP_TEST=1
      shift
      ;;
    --from-env)
      USE_SHELL_ENV=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$USE_SHELL_ENV" -eq 1 ]]; then
  OPENAI_API_KEY="${OPENAI_API_KEY:-$DEFAULT_API_KEY}"
  OPENAI_BASE_URL="${OPENAI_BASE_URL:-$DEFAULT_BASE_URL}"
  CODEX_MODEL="${CODEX_MODEL:-$DEFAULT_MODEL}"
  CODEX_REASONING="${CODEX_REASONING:-$DEFAULT_REASONING}"
fi

if [[ ! "$OPENAI_API_KEY" =~ ^sk- ]]; then
  echo "Error: OPENAI_API_KEY must start with sk-." >&2
  exit 1
fi

backup_if_exists() {
  local file="$1"
  if [[ -f "$file" ]]; then
    cp "$file" "${file}.bak.${TIMESTAMP}"
    echo "  backup: ${file}.bak.${TIMESTAMP}"
  fi
}

write_auth_json() {
  echo "==> ${AUTH_JSON}"
  backup_if_exists "$AUTH_JSON"
  mkdir -p "$(dirname "$AUTH_JSON")"
  cat > "$AUTH_JSON" <<EOF
{
  "auth_mode": "apikey",
  "OPENAI_API_KEY": "${OPENAI_API_KEY}"
}
EOF
}

write_omgt_env() {
  echo "==> ${OMGT_ENV}"
  backup_if_exists "$OMGT_ENV"
  mkdir -p "$(dirname "$OMGT_ENV")"
  cat > "$OMGT_ENV" <<EOF
# Anbalu API — loaded by ~/.zshrc
export OPENAI_API_KEY="${OPENAI_API_KEY}"
export OPENAI_BASE_URL="${OPENAI_BASE_URL}"
export ANTHROPIC_API_KEY="\${OPENAI_API_KEY}"
export ANTHROPIC_BASE_URL="${OPENAI_BASE_URL}"
EOF
}

upsert_config_toml() {
  echo "==> ${CONFIG_TOML}"
  backup_if_exists "$CONFIG_TOML"
  mkdir -p "$(dirname "$CONFIG_TOML")"

  if [[ ! -f "$CONFIG_TOML" ]]; then
    cat > "$CONFIG_TOML" <<EOF
model = "${CODEX_MODEL}"
model_reasoning_effort = "${CODEX_REASONING}"
openai_base_url = "${OPENAI_BASE_URL}"
EOF
    echo "  created new config.toml"
    return
  fi

  if grep -q '^openai_base_url[[:space:]]*=' "$CONFIG_TOML"; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^openai_base_url[[:space:]]*=.*|openai_base_url = \"${OPENAI_BASE_URL}\"|" "$CONFIG_TOML"
    else
      sed -i "s|^openai_base_url[[:space:]]*=.*|openai_base_url = \"${OPENAI_BASE_URL}\"|" "$CONFIG_TOML"
    fi
    echo "  updated openai_base_url"
  else
    printf '\nopenai_base_url = "%s"\n' "$OPENAI_BASE_URL" >> "$CONFIG_TOML"
    echo "  appended openai_base_url"
  fi
}

ensure_zshrc_sources_env() {
  echo "==> ${ZSHRC}"
  if [[ ! -f "$ZSHRC" ]]; then
    touch "$ZSHRC"
  fi

  if grep -Fq "$ZSHRC_MARKER" "$ZSHRC"; then
    echo "  already configured"
    return
  fi

  cat >> "$ZSHRC" <<EOF

${ZSHRC_MARKER}
[ -f "\$HOME/.config/omgt/env" ] && . "\$HOME/.config/omgt/env"
EOF
  echo "  added omgt/env hook"
}

test_api() {
  if [[ "$SKIP_TEST" -eq 1 ]]; then
    echo "==> API test skipped"
    return
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "==> curl not found, skipping API test"
    return
  fi

  echo "==> testing API..."
  local tmp http_code
  tmp="$(mktemp)"
  http_code="$(curl -sS -o "$tmp" -w "%{http_code}" \
    -H "Authorization: Bearer ${OPENAI_API_KEY}" \
    "${OPENAI_BASE_URL%/}/models" || true)"

  if [[ "$http_code" == "200" ]]; then
    echo "  OK (HTTP 200)"
  elif [[ "$http_code" == "401" ]]; then
    echo "  HTTP 401 — check API key" >&2
    cat "$tmp" >&2 || true
  else
    echo "  HTTP ${http_code} (some gateways use non-200 for /models)" >&2
    cat "$tmp" >&2 || true
  fi
  rm -f "$tmp"
}

echo "Codex + Anbalu setup"
echo "  base_url: ${OPENAI_BASE_URL}"

write_auth_json
write_omgt_env
upsert_config_toml
ensure_zshrc_sources_env
test_api

echo
echo "Done."
echo "  1. Restart Codex"
echo "  2. Open a new terminal or run: source ~/.zshrc"
