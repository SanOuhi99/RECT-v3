# worker/tasks/matching.py
import os
import sys
import logging
from datetime import datetime
from celery import current_task

# Add the worker directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from worker.worker import celery_app
from tasks.matching_with_db import run_matching_task

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

@celery_app.task(bind=True, queue='matching')
def run_property_matching(self):
    """Enhanced background task to run property matching with database integration"""
    task_id = self.request.id
    
    try:
        logger.info(f"Starting property matching task {task_id}")
        
        # Update task state
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Starting property matching process', 'progress': 0}
        )
        
        # Run the matching process with database integration
        result = run_matching_task(task_id)
        
        # Update final state
        if result.get('status') == 'completed':
            self.update_state(
                state='SUCCESS',
                meta={
                    'status': 'Property matching completed',
                    'progress': 100,
                    'result': result
                }
            )
        else:
            self.update_state(
                state='FAILURE',
                meta={
                    'status': 'Property matching failed',
                    'error': result.get('error', 'Unknown error'),
                    'result': result
                }
            )
        
        logger.info(f"Property matching task {task_id} completed with status: {result.get('status')}")
        
        return {
            "status": result.get('status'),
            "task_id": task_id,
            "timestamp": datetime.now().isoformat(),
            "processed_owners": result.get('processed_owners', 0),
            "total_matches": result.get('total_matches', 0),
            "total_contacts": result.get('total_contacts', 0),
            "duration_seconds": result.get('duration_seconds', 0),
            "performance_metrics": result.get('performance_metrics', {})
        }
        
    except Exception as e:
        error_msg = f"Error in matching task {task_id}: {str(e)}"
        logger.error(error_msg)
