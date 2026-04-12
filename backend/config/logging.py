import json
import logging
import traceback


class JsonFormatter(logging.Formatter):
    """Emit one JSON object per log line for Loki/Promtail ingestion."""

    def format(self, record):
        obj = {
            "ts": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0] is not None:
            obj["exc"] = traceback.format_exception(*record.exc_info)
        return json.dumps(obj, ensure_ascii=False)
