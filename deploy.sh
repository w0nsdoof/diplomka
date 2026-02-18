#!/usr/bin/env bash
set -euo pipefail

# Configuration
REMOTE_HOST="${DEPLOY_SSH_HOST:-yandex}"
REPO_URL="https://github.com/w0nsdoof/diplomka.git"
COMPOSE_FILE="podman-compose.yml"

# Determine branch: use argument or current local branch
BRANCH="${1:-$(git branch --show-current)}"

echo "==> Deploying branch '$BRANCH' to $REMOTE_HOST"

# Step 1: Ensure remote has a git clone (first-time setup)
# Heredoc is quoted ('SETUP') so variables are expanded on the REMOTE side
ssh "$REMOTE_HOST" bash -s -- "$REPO_URL" "$BRANCH" "$COMPOSE_FILE" <<'SETUP'
  REPO_URL="$1"
  BRANCH="$2"
  COMPOSE_FILE="$3"
  DEPLOY_DIR="$HOME/diplomka"

  if [ ! -d "$DEPLOY_DIR/.git" ]; then
    echo "--- First-time setup: cloning repo"
    # Preserve .env if it exists
    if [ -f "$DEPLOY_DIR/.env" ]; then
      cp "$DEPLOY_DIR/.env" /tmp/.env.deploy.backup
    fi
    rm -rf "$DEPLOY_DIR"
    git clone "$REPO_URL" "$DEPLOY_DIR"
    # Restore .env
    if [ -f /tmp/.env.deploy.backup ]; then
      mv /tmp/.env.deploy.backup "$DEPLOY_DIR/.env"
      echo "--- Restored .env"
    fi
  fi
SETUP

# Step 2: Pull latest code
echo "==> Pulling latest code"
ssh "$REMOTE_HOST" bash -s -- "$BRANCH" <<'PULL'
  BRANCH="$1"
  cd "$HOME/diplomka"
  git fetch origin
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
  echo "--- On commit: $(git log --oneline -1)"
PULL

# Step 3: Rebuild and restart
echo "==> Rebuilding and restarting containers"
ssh "$REMOTE_HOST" bash -s -- "$COMPOSE_FILE" <<'DEPLOY'
  COMPOSE_FILE="$1"
  cd "$HOME/diplomka"

  # Clean up any stale containers that block redeploy
  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

  docker compose -f "$COMPOSE_FILE" build
  docker compose -f "$COMPOSE_FILE" up -d

  echo "--- Waiting for backend to become healthy..."
  timeout 90 bash -c '
    until docker inspect taskmanager-backend --format="{{.State.Health.Status}}" 2>/dev/null | grep -q healthy; do
      sleep 3
    done
  ' && echo "--- Backend is healthy" \
    || echo "--- WARNING: Backend did not become healthy in 90s"

  echo "--- Container status:"
  docker compose -f "$COMPOSE_FILE" ps
DEPLOY

echo "==> Deploy complete!"
