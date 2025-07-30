# worker/tasks.py
from celery import Celery
from worker import app
from tasks.matching import run_property_matching

@celery_app.task
def run_matching_task():
    try:
        result = run_property_matching()
        return {"status": "success", "result": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}
