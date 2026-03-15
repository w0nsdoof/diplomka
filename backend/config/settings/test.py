from .base import *  # noqa: F401, F403

DEBUG = False

# SQLite for test runs (no external DB needed)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Faster password hashing for tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# In-memory cache (no Redis needed)
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# In-memory channel layer (no Redis needed)
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

# Celery runs tasks synchronously in tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# In-memory email backend
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

CORS_ALLOW_ALL_ORIGINS = True

# Disable throttling in tests (keep auth rate so view-level throttle_classes don't error)
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []  # noqa: F405
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {"auth": "10000/minute"}  # noqa: F405

# Suppress logging during tests to keep output clean
LOGGING = {  # noqa: F405
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "null": {
            "class": "logging.NullHandler",
        },
    },
    "root": {
        "handlers": ["null"],
        "level": "CRITICAL",
    },
}
