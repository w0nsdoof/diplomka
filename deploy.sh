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
  SECONDS_WAITED=0
  while [ "$SECONDS_WAITED" -lt 90 ]; do
    HEALTH=$(docker inspect taskmanager-backend --format="{{.State.Health.Status}}" 2>/dev/null || echo "missing")
    STATE=$(docker inspect taskmanager-backend --format="{{.State.Status}}" 2>/dev/null || echo "missing")

    if [ "$HEALTH" = "healthy" ]; then
      break
    fi

    if [ "$STATE" = "exited" ] || [ "$STATE" = "missing" ]; then
      echo "--- FATAL: Backend container is $STATE"
      docker compose -f "$COMPOSE_FILE" logs backend --tail 30
      exit 1
    fi

    sleep 3
    SECONDS_WAITED=$((SECONDS_WAITED + 3))
  done

  if [ "$HEALTH" != "healthy" ]; then
    echo "--- FATAL: Backend did not become healthy in 90s (status: $HEALTH)"
    docker compose -f "$COMPOSE_FILE" logs backend --tail 30
    exit 1
  fi
  echo "--- Backend is healthy"

  echo "--- Container status:"
  docker compose -f "$COMPOSE_FILE" ps
DEPLOY

# Step 4: Post-deploy health verification (always via SSH since REMOTE_HOST may be an alias)
echo "==> Verifying deployment..."
HEALTH_OK=$(ssh "$REMOTE_HOST" "curl -sf -o /dev/null -w '%{http_code}' http://localhost:8000/api/health/ 2>/dev/null || echo 000")

if [ "$HEALTH_OK" != "200" ]; then
  echo "==> FATAL: Health check failed (HTTP $HEALTH_OK)"
  exit 1
fi

echo "==> Deploy complete! Health check passed."
