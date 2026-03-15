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
- At least 2 GB RAM available for containers (4 GB recommended)
- Ports 5432, 6379, 8000, 4200 (or 80) available

## Test Server

A VPS is configured for testing deployment.

### Server Specs

| Spec | Value |
|------|-------|
| **SSH** | `ssh yandex` |
| **vCPU** | 2 |
| **RAM** | 2 GB |
| **Storage** | 30 GB SSD |
| **OS** | Ubuntu 22.04 LTS |

### Quick Connect

```bash
ssh yandex
```

### Initial Server Setup

```bash
# Connect to server
ssh yandex

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# Re-login to apply group changes
exit
ssh yandex

# Clone repository
git clone <your-repo-url> ~/taskmanager
cd ~/taskmanager

# Configure environment
cp .env.example .env
nano .env  # Set production values

# Deploy
docker compose up -d
```

### Memory Optimization (for 2 GB RAM)

With limited RAM, consider these optimizations:

```bash
# Add swap space (2 GB)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Limit PostgreSQL memory in docker-compose override
# Create docker-compose.override.yml with:
cat > docker-compose.override.yml << 'EOF'
services:
  db:
    deploy:
      resources:
        limits:
          memory: 256M
  redis:
    deploy:
      resources:
        limits:
          memory: 64M
  celery-worker:
    deploy:
      resources:
        limits:
          memory: 256M
  celery-beat:
    deploy:
      resources:
        limits:
          memory: 128M
EOF
```

### Access After Deployment

| Service | URL |
|---------|-----|
| Frontend | https://taskmanager.w0nsdoof.com/ |
| Backend API | https://taskmanager.w0nsdoof.com/api/ |
| Swagger UI | https://taskmanager.w0nsdoof.com/api/schema/swagger/ |
| ReDoc | https://taskmanager.w0nsdoof.com/api/schema/redoc/ |
| WebSocket | wss://taskmanager.w0nsdoof.com/ws/ |

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

# Superuser (created automatically on startup)
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=<strong-password>

# Test accounts (optional, omit in production)
TEST_MANAGER_EMAIL=manager@example.com
TEST_MANAGER_PASSWORD=<password>
TEST_ENGINEER_EMAIL=engineer@example.com
TEST_ENGINEER_PASSWORD=<password>
TEST_CLIENT_EMAIL=client@example.com
TEST_CLIENT_PASSWORD=<password>
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
docker compose build

# 3. Start infrastructure services first
docker compose up -d db redis

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
docker compose up -d backend celery-worker celery-beat
sleep 5
docker compose up -d frontend
```

### Initial Users

The backend `entrypoint.sh` automatically creates users on startup from environment variables:

- **Superuser** from `DJANGO_SUPERUSER_EMAIL` / `DJANGO_SUPERUSER_PASSWORD` (role: manager, staff + superuser)
- **Test accounts** from `TEST_MANAGER_EMAIL` / `TEST_MANAGER_PASSWORD`, `TEST_ENGINEER_EMAIL` / `TEST_ENGINEER_PASSWORD`, `TEST_CLIENT_EMAIL` / `TEST_CLIENT_PASSWORD` (one per role)

Users are only created if the env vars are set and the email doesn't already exist. Existing inactive users are automatically activated.

For manual creation, the custom User model requires `--first_name` and `--last_name`:

```bash
docker compose exec backend python manage.py createsuperuser \
    --noinput \
    --email admin@example.com \
    --first_name Admin \
    --last_name User
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
docker compose up -d
```

If the frontend fails to start due to dependency graph issues (a known docker compose
limitation), start services in stages:

```bash
docker compose up -d db redis
sleep 10
docker compose up -d backend celery-worker celery-beat
sleep 5
docker compose up -d frontend
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
docker compose build
docker compose up -d db redis
sleep 10
docker compose up -d backend celery-worker celery-beat
sleep 5
docker compose up -d frontend
```

### 3. Run Migrations

Migrations run automatically on backend container start via the entrypoint command
(`python manage.py migrate`). For manual execution:

```bash
docker compose exec backend python manage.py migrate
```

### 4. Static Files

Static files are collected during the Docker build (`collectstatic --noinput` with
`DJANGO_SETTINGS_MODULE=config.settings.prod`). WhiteNoise serves them in production.

### 5. Create Superuser

The superuser is created automatically on startup from `DJANGO_SUPERUSER_EMAIL` / `DJANGO_SUPERUSER_PASSWORD` in `.env`. Do **not** set `TEST_*` variables in production.

### 6. Compile Translations (if needed)

```bash
docker compose exec backend python manage.py compilemessages
```

## Reverse Proxy (Caddy)

Caddy runs as a standalone service at `~/reverse-proxy/` on the server (not part of this repo).
It handles TLS termination with auto-provisioned Let's Encrypt certificates and routes
traffic by domain to multiple projects.

Traffic flow:
```
Browser → Cloudflare (CDN/DDoS) → Caddy (:443, auto-TLS) → frontend nginx (:80)
                                                              ├── /api/*   → backend:8000
                                                              ├── /ws/*    → backend:8000
                                                              ├── /admin/* → backend:8000
                                                              └── /*       → Angular SPA
```

Required `.env` variables for HTTPS:
```
DJANGO_ALLOWED_HOSTS=taskmanager.w0nsdoof.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://taskmanager.w0nsdoof.com
CSRF_TRUSTED_ORIGINS=https://taskmanager.w0nsdoof.com
SECURE_SSL_REDIRECT=1
```

Cloudflare SSL/TLS mode must be set to **Full (Strict)**.

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
docker compose exec db pg_dump -U taskmanager taskmanager > backup_$(date +%Y%m%d).sql

# Database restore
docker compose exec -T db psql -U taskmanager taskmanager < backup_20260131.sql

# Media files backup
podman volume export diplomka_media_data > media_backup_$(date +%Y%m%d).tar
```

## Health Checks

Built-in health checks are configured for:

- **PostgreSQL**: `pg_isready` (5s interval, 5 retries)
- **Redis**: `redis-cli ping` (5s interval, 5 retries)

Backend and Celery services use `depends_on` with `condition: service_healthy` to wait
for infrastructure readiness. Note: docker compose translates these to `--requires` flags.

## Monitoring

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f celery-worker
docker compose logs -f celery-beat
```

### Sentry Integration

Add `SENTRY_DSN` to `.env` for production error tracking. The `sentry-sdk` package is
included in production requirements.

## Scaling Considerations

- **Celery workers**: Scale horizontally with `docker compose up --scale celery-worker=3`
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
| Superuser not created on startup | Verify `DJANGO_SUPERUSER_EMAIL` and `DJANGO_SUPERUSER_PASSWORD` are set in `.env` and passed to the backend in `docker-compose.yml` |
| Manual `createsuperuser` fails with `--noinput` | Must include `--first_name` and `--last_name` flags (custom User model) |
| Podman "short-name did not resolve" | All images use `docker.io/library/` prefix; check your registries.conf if pulling fails |

## Useful Management Commands

```bash
# Django shell
docker compose exec backend python manage.py shell

# Check system configuration
docker compose exec backend python manage.py check --deploy

# Run specific migration
docker compose exec backend python manage.py migrate <app_name>

# Generate OpenAPI schema file
docker compose exec backend python manage.py spectacular --file schema.yml

# Generate migrations after model changes
docker compose exec backend python manage.py makemigrations

# Compile translation messages
docker compose exec backend python manage.py compilemessages
```
