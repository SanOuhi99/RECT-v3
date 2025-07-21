# worker/tasks.py
from celery import Celery
from worker.worker import celery_app
from app.tasks.matching import run_matching_algorithm

@celery_app.task
def run_matching_task():
    try:
        result = run_matching_algorithm()
        return {"status": "success", "result": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}