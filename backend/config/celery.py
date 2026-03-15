import logging
import os

from celery import Celery
from celery.signals import task_failure, task_postrun, task_prerun

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

logger = logging.getLogger(__name__)

app = Celery("taskmanager")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, **kwargs):
    logger.info("Celery task starting: %s[%s]", task.name, task_id)


@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, retval=None, state=None, **kwargs):
    logger.info("Celery task finished: %s[%s] state=%s", task.name, task_id, state)


@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, traceback=None, **kwargs):
    logger.error("Celery task failed: %s[%s] %s", sender.name, task_id, exception)
