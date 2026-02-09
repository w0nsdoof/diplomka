# Known Issues

## 1. WebSocket URL hardcoded to localhost

The Kanban board's WebSocket connection uses `ws://localhost:80/ws/kanban/` in production, causing 403 errors on the remote server. Real-time task updates don't work; the board still loads fine via REST.

**Fix:** Make the WS URL configurable through `environment.prod.ts` using the server hostname/IP.

---

## 2. Untracked files required for deployment

`backend/entrypoint.sh` and `backend/apps/clients/migrations/0002_alter_client_name.py` are not committed to git. Deploying from a fresh `git clone` fails without manually copying these files.

**Fix:** Commit both files to the repository.

---

## 3. Migration race condition on first start

When `backend`, `celery-worker`, and `celery-beat` all start simultaneously, they each run `entrypoint.sh` which calls `migrate`. Concurrent migration attempts cause `duplicate key` errors and crash the worker/beat containers.

**Fix:** Either remove migrations from the worker/beat entrypoint (use a separate command override), or just restart failed containers after backend finishes migrating.

---

## 4. No CI/CD pipeline

Deployment is fully manual: rsync files, SSH in, rebuild, restart. Any code change requires repeating the full process.

**Fix:** Add a GitHub Actions workflow that on push to `main` SSHs into the server and runs `git pull && docker compose -f podman-compose.yml up -d --build`.

---

## 5. No deploy key for private repo access

The server clones via HTTPS (works while repo is public). If the repo goes private, deployment breaks.

**Fix:** Generate an SSH deploy key on the server, add it as a read-only deploy key in GitHub repo settings, switch remote to SSH.

---

## 6. No HTTPS

The application is served over plain HTTP on ports 4200 and 8000. Credentials and JWT tokens are transmitted unencrypted.

**Fix:** Add Caddy or Nginx as a reverse proxy with Let's Encrypt auto-TLS. ~5 lines of Caddyfile config.

---

## 7. Django admin panel missing CSS

The Django admin at `/admin/` renders without styles when `DEBUG=False`. WhiteNoise is installed and configured for serving static files in production, but the admin panel CSS may not load if `collectstatic` wasn't run with the correct settings or if the `STATIC_URL`/`STATICFILES_STORAGE` configuration doesn't match.

**Fix:** Ensure `STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"` is set in `prod.py`, `whitenoise.middleware.WhiteNoiseMiddleware` is in `MIDDLEWARE` (right after `SecurityMiddleware`), and `collectstatic --noinput` runs during the Docker build with `DJANGO_SETTINGS_MODULE=config.settings.prod`.

---

## 8. No backend health check endpoint

There is no `/api/health/` endpoint to verify the backend is actually serving requests. Docker health checks only exist for `db` and `redis`.

**Fix:** Add a simple health view returning 200 and wire it into the Docker `healthcheck` for the backend container.

---

## 9. Staged container startup with sleep

Services must be started in stages with `sleep` delays because podman-compose doesn't fully respect `depends_on` health conditions. Docker Compose v2 on the server supports `--wait` but we don't use it.

**Fix:** Use `docker compose up -d --wait` or add health checks to the backend container so `depends_on` with `condition: service_healthy` works end-to-end.
