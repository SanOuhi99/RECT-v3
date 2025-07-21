from worker.worker import app
from datetime import datetime
import logging
import os
import sys

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Add your scripts directory to path
scripts_path = os.path.join(os.path.dirname(__file__), '../../../scripts')
sys.path.append(scripts_path)

@app.task(bind=True, queue='matching')
def run_property_matching(self, user_id):
    """Background task to run property matching for a specific user"""
    try:
        logger.info(f"Starting property matching task for user {user_id}")
        
        # Import your existing matching script
        from KvCore_DT_scan_matches import search_datatree_thread
        
        # Run the matching process
        search_datatree_thread()
        
        logger.info(f"Completed property matching task for user {user_id}")
        return {
            "status": "success",
            "user_id": user_id,
            "task_id": self.request.id,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error in matching task for user {user_id}: {str(e)}")
        raise self.retry(exc=e, countdown=60)