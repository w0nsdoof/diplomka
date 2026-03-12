import os
from datetime import timedelta
from pathlib import Path

from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "insecure-dev-key-change-me")

DEBUG = False

ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# Application definition

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "channels",
    # Local apps
    "apps.organizations",
    "apps.platform",
    "apps.accounts",
    "apps.tasks",
    "apps.clients",
    "apps.comments",
    "apps.tags",
    "apps.attachments",
    "apps.notifications",
    "apps.reports",
    "apps.audit",
    "apps.ai_summaries",
    "apps.telegram",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "config.middleware.RequestLoggingMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

# Database

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "taskmanager"),
        "USER": os.getenv("POSTGRES_USER", "taskmanager"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "changeme"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

# Auth

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# JWT

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("ACCESS_TOKEN_LIFETIME_MINUTES", 30))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("REFRESH_TOKEN_LIFETIME_DAYS", 7))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# DRF

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "config.authentication.OrganizationJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "config.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "config.exceptions.custom_exception_handler",
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# drf-spectacular

SPECTACULAR_SETTINGS = {
    "TITLE": "Task Management System API",
    "DESCRIPTION": (
        "API for IT outsourcing task management.\n\n"
        "## Authentication\n\n"
        "1. **Login**: `POST /api/auth/token/` with `{email, password}` — returns `{access}` in body, "
        "sets `refresh_token` as httpOnly cookie.\n"
        "2. **Refresh**: `POST /api/auth/token/refresh/` — no body needed, reads cookie, returns new `{access}`.\n"
        "3. **Logout**: `POST /api/auth/logout/` — clears cookie.\n"
        "4. All other endpoints require `Authorization: Bearer <access_token>` header.\n\n"
        "## Roles\n\n"
        "- **manager** — full access (CRUD tasks, users, clients, reports, audit history)\n"
        "- **engineer** — tasks + kanban only (limited create/update)\n"
        "- **client** — portal only (own tickets, public comments)\n\n"
        "## Pagination\n\n"
        "All list endpoints return `{count, next, previous, results[]}` with `?page` and `?page_size` (max 100).\n\n"
        "## Errors\n\n"
        "- Validation errors: `{field_name: [\"error message\"]}` (400)\n"
        "- Permission errors: `{detail: \"message\"}` (403)\n"
        "- Optimistic lock conflicts: `{detail: \"message\", code: \"conflict\"}` (409)\n\n"
        "## WebSocket\n\n"
        "Real-time Kanban updates via `ws://<host>/ws/kanban/?token=<JWT>`. "
        "See `docs/websocket-api.md` for full protocol documentation."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SECURITY": [{"jwtAuth": []}],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "jwtAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            },
        },
    },
    "TAGS": [
        {"name": "Auth", "description": "JWT authentication (login, refresh, logout, verify)"},
        {"name": "Users", "description": "User management (CRUD, role assignment). Manager-only."},
        {"name": "Tasks", "description": "Task CRUD, status transitions, assignment, and audit history"},
        {"name": "Clients", "description": "Client company management"},
        {"name": "Portal", "description": "Client portal — read-only tickets for client-role users"},
        {"name": "Comments", "description": "Task comments with @mention support"},
        {"name": "Attachments", "description": "File upload/download per task (max 25 MB)"},
        {"name": "Tags", "description": "Tag management (label tasks by category)"},
        {"name": "Notifications", "description": "In-app notification inbox"},
        {"name": "Reports", "description": "Report data, PDF and Excel exports"},
        {"name": "Summaries", "description": "AI-generated report summaries"},
        {"name": "Platform", "description": "Superadmin organization management"},
        {"name": "Telegram", "description": "Telegram bot linking and notification preferences"},
    ],
    "ENUM_NAME_OVERRIDES": {
        "TaskStatusEnum": "apps.tasks.models.Task.Status",
        "TaskPriorityEnum": "apps.tasks.models.Task.Priority",
        "SummaryStatusEnum": "apps.ai_summaries.models.ReportSummary.Status",
        "SummaryPeriodTypeEnum": "apps.ai_summaries.models.ReportSummary.PeriodType",
        "SummaryGenerationMethodEnum": "apps.ai_summaries.models.ReportSummary.GenerationMethod",
        "NotificationEventTypeEnum": "apps.notifications.models.Notification.EventType",
        "ClientTypeEnum": "apps.clients.models.Client.ClientType",
    },
}

# Channels

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [os.getenv("REDIS_URL", "redis://localhost:6379/0")],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}

# Celery

CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"

CELERY_BEAT_SCHEDULE = {
    "check-approaching-deadlines": {
        "task": "apps.notifications.tasks.check_approaching_deadlines",
        "schedule": crontab(minute=0, hour="*/1"),
    },
    "generate-daily-summary": {
        "task": "apps.ai_summaries.tasks.generate_daily_summary",
        "schedule": crontab(minute=5, hour=0),
    },
    "generate-weekly-summary": {
        "task": "apps.ai_summaries.tasks.generate_weekly_summary",
        "schedule": crontab(minute=0, hour=6, day_of_week=1),
    },
    "auto-archive-done-tasks": {
        "task": "apps.tasks.tasks.auto_archive_done_tasks",
        "schedule": crontab(minute=0, hour="*/1"),
    },
    "cleanup-expired-telegram-codes": {
        "task": "apps.telegram.tasks.cleanup_expired_verification_codes",
        "schedule": crontab(minute=0, hour="*/1"),
    },
}

# LLM (AI Summaries)

# Telegram Bot
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")

LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-4o-mini")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_API_BASE = os.getenv("LLM_API_BASE", "")
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", 2000))
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", 0.3))

# Internationalization

LANGUAGE_CODE = "en-us"

USE_I18N = False

TIME_ZONE = "UTC"
USE_TZ = True

# Static / Media

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# File uploads

DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Logging

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
        "request": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "config": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
    },
}
