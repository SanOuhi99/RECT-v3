import requests
import time
import logging
from functools import wraps
from typing import Optional, Dict, Any

# Configure comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/data/application.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class APIRateLimiter:
    """Rate limiter to prevent API quota exhaustion"""
    def __init__(self, max_calls: int = 100, time_window: int = 3600):
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = []
    
    def can_make_call(self) -> bool:
        now = time.time()
        # Remove calls outside the time window
        self.calls = [call_time for call_time in self.calls if now - call_time < self.time_window]
        return len(self.calls) < self.max_calls
    
    def record_call(self):
        self.calls.append(time.time())

# Global rate limiter instance
rate_limiter = APIRateLimiter()

def retry_with_exponential_backoff(max_retries: int = 3, base_delay: float = 1.0, max_delay: float = 60.0):
    """Decorator for retry logic with exponential backoff"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    # Check rate limiting before making the call
                    if not rate_limiter.can_make_call():
                        wait_time = 60  # Wait 1 minute if rate limited
                        logger.warning(f"Rate limit reached, waiting {wait_time} seconds")
                        time.sleep(wait_time)
                    
                    result = func(*args, **kwargs)
                    rate_limiter.record_call()
                    return result
                    
                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 429:  # Rate limited
                        wait_time = min(base_delay * (2 ** attempt), max_delay)
                        logger.warning(f"Rate limited (429), waiting {wait_time} seconds before retry {attempt + 1}")
                        time.sleep(wait_time)
                    elif e.response.status_code >= 500:  # Server error
                        wait_time = min(base_delay * (2 ** attempt), max_delay)
                        logger.error(f"Server error {e.response.status_code}, retrying in {wait_time} seconds")
                        time.sleep(wait_time)
                    else:
                        logger.error(f"HTTP error {e.response.status_code}: {e}")
                        raise
                        
                except requests.exceptions.ConnectionError as e:
                    wait_time = min(base_delay * (2 ** attempt), max_delay)
                    logger.error(f"Connection error, retrying in {wait_time} seconds: {e}")
                    time.sleep(wait_time)
                    
                except requests.exceptions.Timeout as e:
                    wait_time = min(base_delay * (2 ** attempt), max_delay)
                    logger.error(f"Timeout error, retrying in {wait_time} seconds: {e}")
                    time.sleep(wait_time)
                    
                except Exception as e:
                    logger.error(f"Unexpected error in {func.__name__}: {e}")
                    if attempt == max_retries:
                        raise
                    time.sleep(base_delay)
            
            logger.error(f"All {max_retries} retries failed for {func.__name__}")
            return None
        return wrapper
    return decorator

@retry_with_exponential_backoff(max_retries=3)
def authenticate_datatree_enhanced():
    """Enhanced authentication with better error handling"""
    url = f"{DATATREE_BASE_URL}{AUTH_ENDPOINT}"
    payload = {
        "ClientId": CLIENT_ID,
        "ClientSecretKey": CLIENT_SECRET
    }
    headers = {"Content-Type": "application/json"}
    
    logger.info("Authenticating with DataTree API")
    
    try:
        response = requests.post(
            url, 
            json=payload, 
            headers=headers,
            timeout=30  # Add explicit timeout
        )
        response.raise_for_status()
        
        token = response.text.strip().strip('"')
        if not token:
            raise ValueError("Received empty authentication token")
            
        logger.info("DataTree authentication successful")
        return token
        
    except requests.exceptions.RequestException as e:
        logger.error(f"DataTree authentication failed: {e}")
        raise

@retry_with_exponential_backoff(max_retries=2)
def fetch_all_contacts_enhanced(kvcore_token: str):
    """Enhanced contact fetching with better error handling"""
    url = "https://api.kvcore.com/v2/public/contacts"
    headers = {
        "accept": "application/json",
        "Content-Type": "application/json",
        "authorization": f"Bearer {kvcore_token}"
    }
    
    try:
        import cloudscraper
        scraper = cloudscraper.create_scraper()
        response = scraper.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        data = response.json().get("data", [])
        logger.info(f"Successfully fetched {len(data)} contacts from KvCore")
        return data
        
    except Exception as e:
        logger.error(f"Failed to fetch contacts from KvCore: {e}")
        return []

def validate_contact_data(contact: Dict[str, Any]) -> bool:
    """Validate contact data before processing"""
    required_fields = ['name', 'email']
    
    for field in required_fields:
        if not contact.get(field):
            logger.warning(f"Contact missing required field '{field}': {contact}")
            return False
    
    # Basic email validation
    email = contact.get('email', '')
    if '@' not in email or '.' not in email:
        logger.warning(f"Invalid email format: {email}")
        return False
    
    # Name validation
    name = contact.get('name', '').strip()
    if len(name) < 2:
        logger.warning(f"Name too short: {name}")
        return False
    
    return True

class APIHealthChecker:
    """Monitor API health and connection status"""
    def __init__(self):
        self.last_successful_datatree_call = None
        self.last_successful_kvcore_call = None
        self.consecutive_failures = {}
    
    def record_success(self, api_name: str):
        """Record successful API call"""
        if api_name == 'datatree':
            self.last_successful_datatree_call = time.time()
        elif api_name == 'kvcore':
            self.last_successful_kvcore_call = time.time()
        
        self.consecutive_failures[api_name] = 0
    
    def record_failure(self, api_name: str):
        """Record failed API call"""
        self.consecutive_failures[api_name] = self.consecutive_failures.get(api_name, 0) + 1
        
        if self.consecutive_failures[api_name] >= 5:
            logger.critical(f"API {api_name} has failed {self.consecutive_failures[api_name]} consecutive times")
    
    def is_healthy(self, api_name: str, max_failures: int = 3) -> bool:
        """Check if API is considered healthy"""
        return self.consecutive_failures.get(api_name, 0) < max_failures

# Global health checker
health_checker = APIHealthChecker()
