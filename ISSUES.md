# Issues Tracker

> Add issues below. Remove after fix is committed. Format:
> `| Short description | S(1-3) | C(1-3) | Notes |`
> Severity: 1=critical 2=major 3=minor | Complexity: 1=quick 2=moderate 3=hard

## Backend

| Issue | Sev | Cpx | Notes |
|-------|-----|-----|-------|
| No API rate limiting | 1 | 2 | No DRF throttle classes; auth endpoints vulnerable to brute-force |
| N+1 query patterns | 2 | 2 | ClientDetailSerializer loops `.count()`, Task views missing prefetch |
| No transaction safety on writes | 2 | 2 | Task create + assignee set not atomic; partial failures possible |
| No Redis caching for reads | 3 | 2 | Redis only used for Channels + Celery; no view/query caching |
| Celery hardcodes dev settings module | 3 | 1 | `config/celery.py` hardcodes `settings.dev`; should use env var |
| Celery worker/beat race on first start | 3 | 1 | Fails if backend still migrating; restart fixes it |

## Frontend

| Issue | Sev | Cpx | Notes |
|-------|-----|-----|-------|
| i18n set up but empty | 3 | 2 | en.json/ru.json are `{}`; no translation markers in templates |

## Infrastructure

| Issue | Sev | Cpx | Notes |
|-------|-----|-----|-------|
| No HTTPS | 2 | 2 | nginx listens HTTP only; needs reverse proxy or cert setup |
| Security | 3 | 1 | CORS, Security Headers, other stuff |

## Deployment

| Issue | Sev | Cpx | Notes |
|-------|-----|-----|-------|
| Backend bind-mounts source in production | 2 | 1 | `./backend:/app` volume mount overrides the built Docker image contents. This is a dev pattern — in production the image should be self-contained. The mount means source code directly affects running containers, bypasses the build cache, and `collectstatic` output from the build gets overridden |
| Entrypoint recreates test users on every restart | 3 | 1 | `entrypoint.sh` creates test accounts (manager/engineer/client) on startup. If remote .env has different passwords than what's in the DB, login fails. Entrypoint should update passwords if users already exist, or test accounts should not be created in production |
