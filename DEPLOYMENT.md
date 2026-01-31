# Deployment Guide: Task Management System

## Architecture Overview

The application consists of six containerized services:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **db** | PostgreSQL 16 Alpine | 5432 | Primary database |
| **redis** | Redis 7 Alpine | 6379 | Channels layer + Celery broker |
| **backend** | Python 3.11-slim (Daphne ASGI) | 8000 | Django API + WebSocket |
| **frontend** | Node 18 build -> Nginx Alpine | 80 (mapped 4200) | Angular SPA |
| **celery-worker** | Same as backend | - | Async task processing (email notifications) |
| **celery-beat** | Same as backend | - | Periodic task scheduler (deadline checks) |

## Prerequisites

- Podman (or Docker) with Compose support
- At least 4 GB RAM available for containers
- Ports 5432, 6379, 8000, 4200 (or 80) available

### Podman Registry Configuration

If using Podman without Docker compatibility, ensure unqualified image registries are configured.
All Dockerfiles and compose files use fully qualified image names (`docker.io/library/...`),
so this should work out of the box. If you encounter "short-name did not resolve" errors,
add the following to `/etc/containers/registries.conf`:

```toml
unqualified-search-registries = ["docker.io"]
```

## Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

### Required Variables

```env
# Database
POSTGRES_DB=taskmanager
POSTGRES_USER=taskmanager
POSTGRES_PASSWORD=<strong-random-password>

# Django
DJANGO_SECRET_KEY=<generate-with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
DJANGO_SETTINGS_MODULE=config.settings.dev    # Use config.settings.prod for production
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# JWT
ACCESS_TOKEN_LIFETIME_MINUTES=30
REFRESH_TOKEN_LIFETIME_DAYS=7

# Superuser
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=<strong-password>
```

### Additional Production Variables

Set `DJANGO_SETTINGS_MODULE=config.settings.prod` and configure these in `.env`:

```env
# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# SSL redirect (set to True if behind HTTPS termination)
SECURE_SSL_REDIRECT=True

# Email (for client portal notifications)
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_HOST_USER=notifications@yourdomain.com
EMAIL_HOST_PASSWORD=<email-password>
DEFAULT_FROM_EMAIL=noreply@yourdomain.com

# Sentry (optional, error tracking)
SENTRY_DSN=https://your-sentry-dsn
```

## Development Deployment

### First-Time Setup

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env with your values

# 2. Build all images
podman-compose build

# 3. Start infrastructure services first
podman-compose up -d db redis

# 4. Wait for health checks to pass (~10 seconds)
sleep 10

# 5. Generate migrations (required on first run)
podman run --rm \
  -e DJANGO_SETTINGS_MODULE=config.settings.dev \
  -e DJANGO_SECRET_KEY=dev-key \
  -e POSTGRES_HOST=db \
  -e POSTGRES_DB=taskmanager \
  -e POSTGRES_USER=taskmanager \
  -e POSTGRES_PASSWORD=<your-db-password> \
  -e REDIS_URL=redis://redis:6379/0 \
  -v ./backend:/app \
  --net diplomka_default \
  diplomka_backend python manage.py makemigrations

# 6. Start remaining services
podman-compose up -d backend celery-worker celery-beat
sleep 5
podman-compose up -d frontend
```

### Create Initial Superuser

The custom User model requires `--first_name` and `--last_name` fields:

```bash
podman-compose exec backend python manage.py createsuperuser \
    --noinput \
    --email admin@example.com \
    --first_name Admin \
    --last_name User
```

Then set the password:

```bash
podman-compose exec backend python manage.py shell -c "
from apps.accounts.models import User
u = User.objects.get(email='admin@example.com')
u.set_password('your-password')
u.save()
"
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:  4200 |
| Backend API | http://localhost:8000/api/ |
| Swagger UI | http://localhost:8000/api/schema/swagger/ |
| Redoc | http://localhost:8000/api/schema/redoc/ |
| WebSocket | ws://localhost:8000/ws/kanban/?token=JWT_TOKEN |
| API via Frontend proxy | http://localhost:4200/api/ |

### Subsequent Starts

After initial setup, starting is simpler:

```bash
podman-compose up -d
```

If the frontend fails to start due to dependency graph issues (a known podman-compose
limitation), start services in stages:

```bash
podman-compose up -d db redis
sleep 10
podman-compose up -d backend celery-worker celery-beat
sleep 5
podman-compose up -d frontend
```

## Production Deployment

### 1. Prepare Environment

```bash
cp .env.example .env
# Edit .env with production values
# Set DJANGO_SETTINGS_MODULE=config.settings.prod
# Set a strong DJANGO_SECRET_KEY
# Set DJANGO_ALLOWED_HOSTS to your domain(s)
# Configure CORS_ALLOWED_ORIGINS, EMAIL_*, and optionally SENTRY_DSN
```

### 2. Build and Start

```bash
podman-compose build
podman-compose up -d db redis
sleep 10
podman-compose up -d backend celery-worker celery-beat
sleep 5
podman-compose up -d frontend
```

### 3. Run Migrations

Migrations run automatically on backend container start via the entrypoint command
(`python manage.py migrate`). For manual execution:

```bash
podman-compose exec backend python manage.py migrate
```

### 4. Static Files

Static files are collected during the Docker build (`collectstatic --noinput` with
`DJANGO_SETTINGS_MODULE=config.settings.prod`). WhiteNoise serves them in production.

### 5. Create Superuser

```bash
podman-compose exec backend python manage.py createsuperuser \
    --email admin@yourdomain.com \
    --first_name Admin \
    --last_name User
```

### 6. Compile Translations (if needed)

```bash
podman-compose exec backend python manage.py compilemessages
```

## Reverse Proxy Setup (Recommended)

In production, place an external reverse proxy (Nginx, Caddy, Traefik) in front of the
frontend container for TLS termination.

### Example: Nginx Site Config

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:4200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket connections are proxied through the frontend Nginx
    # container to the backend automatically via /ws/ location block
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
```

## Service Details

### Backend (Daphne ASGI)

- Serves both HTTP API and WebSocket connections via Daphne
- Static files served by WhiteNoise in production
- File uploads stored in the `media_data` volume
- Max upload size: 25 MB
- Dev mode mounts `./backend:/app` for live code reloading

### Frontend (Nginx)

- Angular SPA built with `--configuration production` (AOT compilation, minification)
- Nginx handles SPA routing (`try_files $uri $uri/ /index.html`)
- Proxies `/api/` requests to the backend container
- Proxies `/ws/` WebSocket connections to the backend container

### Celery Worker

- Processes async tasks: `send_client_status_email`, `check_approaching_deadlines`
- Uses Redis as broker
- Connected to the same database for ORM access

### Celery Beat

- Runs periodic tasks on schedule
- **check-approaching-deadlines**: Runs hourly, notifies assignees of tasks due within 24 hours

## Data Persistence

Two named volumes are configured:

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `diplomka_postgres_data` | `/var/lib/postgresql/data` | Database files |
| `diplomka_media_data` | `/app/media` | Uploaded file attachments |

### Backup Strategy

```bash
# Database backup
podman-compose exec db pg_dump -U taskmanager taskmanager > backup_$(date +%Y%m%d).sql

# Database restore
podman-compose exec -T db psql -U taskmanager taskmanager < backup_20260131.sql

# Media files backup
podman volume export diplomka_media_data > media_backup_$(date +%Y%m%d).tar
```

## Health Checks

Built-in health checks are configured for:

- **PostgreSQL**: `pg_isready` (5s interval, 5 retries)
- **Redis**: `redis-cli ping` (5s interval, 5 retries)

Backend and Celery services use `depends_on` with `condition: service_healthy` to wait
for infrastructure readiness. Note: podman-compose translates these to `--requires` flags.

## Monitoring

### Logs

```bash
# All services
podman-compose logs -f

# Specific service
podman-compose logs -f backend
podman-compose logs -f celery-worker
podman-compose logs -f celery-beat
```

### Sentry Integration

Add `SENTRY_DSN` to `.env` for production error tracking. The `sentry-sdk` package is
included in production requirements.

## Scaling Considerations

- **Celery workers**: Scale horizontally with `podman-compose up --scale celery-worker=3`
- **Database**: For high load, consider a managed PostgreSQL service and update `POSTGRES_HOST`
- **Redis**: For high WebSocket concurrency, consider Redis Sentinel or a managed Redis service
- **File storage**: For multi-node deployments, replace local `MEDIA_ROOT` with S3-compatible storage (requires `django-storages`)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend `ModuleNotFoundError: debug_toolbar` | The container image includes both dev and prod dependencies. Verify `./backend` volume mount is correct |
| Backend fails to start | Check `podman logs taskmanager-backend` — likely a database connection or migration error |
| `No migrations to apply` but tables missing | Run `makemigrations` first — migration files must exist in `apps/*/migrations/` directories |
| Frontend container won't start (dependency graph error) | Start services in stages: `db/redis` first, then `backend/celery`, then `frontend` |
| WebSocket not connecting | Verify `/ws/` proxy passes `Upgrade` and `Connection` headers; check JWT token in query param |
| Celery tasks not executing | Check `podman logs taskmanager-worker` and verify Redis connectivity |
| Static files 404 in production | Ensure `DJANGO_SETTINGS_MODULE=config.settings.prod` for WhiteNoise |
| CORS errors | Set `CORS_ALLOWED_ORIGINS` in `.env` to your frontend domain |
| File upload fails | Check `client_max_body_size` in external Nginx (must be >= 25M) |
| `createsuperuser` fails with `--noinput` | Must include `--first_name` and `--last_name` flags (custom User model) |
| Podman "short-name did not resolve" | All images use `docker.io/library/` prefix; check your registries.conf if pulling fails |

## Useful Management Commands

```bash
# Django shell
podman-compose exec backend python manage.py shell

# Check system configuration
podman-compose exec backend python manage.py check --deploy

# Run specific migration
podman-compose exec backend python manage.py migrate <app_name>

# Generate OpenAPI schema file
podman-compose exec backend python manage.py spectacular --file schema.yml

# Generate migrations after model changes
podman-compose exec backend python manage.py makemigrations

# Compile translation messages
podman-compose exec backend python manage.py compilemessages
```
