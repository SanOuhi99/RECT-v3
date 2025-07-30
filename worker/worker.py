import os
import logging
from celery import Celery
from kombu import Queue
import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration

# Production logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Sentry for error tracking
if os.getenv("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        integrations=[CeleryIntegration()],
        traces_sample_rate=0.1,
        environment=os.getenv("ENVIRONMENT", "production"),
    )

# Redis configuration
redis_url = os.getenv('REDIS_URL')
if not redis_url:
    raise ValueError("REDIS_URL environment variable is required")

# Celery app configuration
app = Celery(
    'worker',
    broker=redis_url,
    backend=redis_url,
    include=['tasks.matching']
)

# Production-optimized configuration
app.conf.update(
    # Serialization
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    
    # Timezone
    timezone='UTC',
    enable_utc=True,
    
    # Task execution
    task_track_started=True,
    task_time_limit=45 * 60,  # 45 minutes
    task_soft_time_limit=40 * 60,  # 40 minutes
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    
    # Memory management
    worker_max_tasks_per_child=100,
    worker_disable_rate_limits=True,
    
    # Result backend
    result_expires=3600,  # 1 hour
    result_persistent=True,
    
    # Connection settings
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=10,
    
    # Task routing
    task_queues=(
        Queue('default', routing_key='task.default'),
        Queue('matching', routing_key='task.matching', 
              message_ttl=7200),  # 2 hours TTL
    ),
    task_routes={
        'tasks.matching.run_property_matching': {'queue': 'matching'},
    },
    task_default_queue='default',
    task_default_exchange='default',
    task_default_routing_key='task.default',
)

@app.task(bind=True)
def debug_task(self):
    logger.info(f'Request: {self.request!r}')

if __name__ == '__main__':
    app.start()
