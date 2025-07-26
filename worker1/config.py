import os
from datetime import timedelta

class Config:
    # Flask Configuration
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # Database Configuration
    DATA_DIR = "/app/data"
    CRM_OWNERS_FILE = os.path.join(DATA_DIR, "crm_owners.json")
    CREDENTIALS_FILE = os.path.join(DATA_DIR, "credentials.txt")
    
    # API Configuration
    DATATREE_CLIENT_ID = os.getenv('DATATREE_CLIENT_ID')
    DATATREE_CLIENT_SECRET = os.getenv('DATATREE_CLIENT_SECRET')
    DATATREE_BASE_URL = "https://dtapiuat.datatree.com"
    
    # Email Configuration
    SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.mailgun.org')
    SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
    SENDER_EMAIL = os.getenv('SENDER_EMAIL')
    SMTP_USERNAME = os.getenv('SMTP_USERNAME')
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
    
    # Authentication
    JWT_EXPIRATION_DELTA = timedelta(hours=24)
    ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@realestateclienttracker.com')
    ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'change-this-password')
    
    # Performance Settings
    MAX_CONCURRENT_THREADS = int(os.getenv('MAX_CONCURRENT_THREADS', '5'))
    MAX_CONTACT_THREADS = int(os.getenv('MAX_CONTACT_THREADS', '10'))
    
    # Monitoring
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    ENABLE_METRICS = os.getenv('ENABLE_METRICS', 'true').lower() == 'true'

class DevelopmentConfig(Config):
    DEBUG = True
    
class ProductionConfig(Config):
    DEBUG = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
