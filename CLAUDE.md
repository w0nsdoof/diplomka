# Development Guidelines

See [README.md](README.md) for project overview, tech stack, and setup.

## Git Workflow

- **`main`** — stable branch, auto-deploys to production on push
- **Feature branches** — `NNN-feature-name` (e.g. `003-add-caching`)
- Work on feature branch, push, create PR to `main`
- CI runs on PR (lint + test + build); merge triggers deploy
- Never push directly to `main` — always go through a PR

## CI/CD

- **PR to `main`**: runs backend lint (ruff), backend tests (pytest), frontend tests (karma), frontend build
- **Push to `main`**: runs CI, then auto-deploys via SSH to production server
- Workflows: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- Deploy uses a dedicated `deploy` user on the server (not root)

## Commands

```bash
# Deploy (manual fallback)
./deploy.sh                    # deploy current branch
./deploy.sh main               # deploy specific branch

# Backend
cd backend && python manage.py runserver
cd backend && python -m pytest tests/
cd backend && ruff check .

# Frontend
cd frontend && npm start       # dev server on :4200
cd frontend && npm run test:ci # headless tests
```

## Code Style

- Python: PEP 8, enforced by `ruff` (config in `backend/pyproject.toml`)
- TypeScript: Angular style guide
- All Angular components use standalone (no NgModules) + `OnPush` change detection

## Deployment

- Script: `deploy.sh` — git-pull based, SSHes to server (`ssh yandex` for manual, `deploy` user for CI)
- Compose file: `podman-compose.yml` with `name: taskmanager`
- Remote `.env` is managed separately on the server (NOT synced from local)

## Issue Tracking

Known bugs and issues are tracked in [ISSUES.md](ISSUES.md). When fixing an issue, remove its row from the table in the same commit as the fix.
