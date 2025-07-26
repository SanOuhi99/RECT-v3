import os
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

@dataclass
class DataTreeConfig:
    """DataTree API configuration"""
    client_id: str
    client_secret: str
    base_url: str = "https://dtapiuat.datatree.com"
    auth_endpoint: str = "/api/Login/AuthenticateClient"
    report_endpoint: str = "/api/Report/GetReport"
    search_endpoint: str = "/api/Search/PropertySearch"
    timeout: int = 30
    max_retries: int = 3

@dataclass
class EmailConfig:
    """Email configuration"""
    smtp_server: str
    smtp_port: int
    sender_email: str
    smtp_username: str
    smtp_password: str
    use_tls: bool = True

@dataclass
class AppConfig:
    """Main application configuration"""
    data_dir: str = "/app/data"
    crm_owners_file: str = "crm_owners.json"
    credentials_file: str = "credentials.txt"
    logo_path: str = "/app/data/logo.jpg"
    max_concurrent_threads: int = 5
    max_contact_threads: int = 10
    search_months_back: int = 6
    log_level: str = "INFO"

class ConfigManager:
    """Centralized configuration management with environment variable support"""
    
    def __init__(self, data_dir: str = "/app/data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        self.app_config = AppConfig(data_dir=str(self.data_dir))
        self.datatree_config = self._load_datatree_config()
        self.email_config = self._load_email_config()
    
    def _load_datatree_config(self) -> DataTreeConfig:
        """Load DataTree configuration from environment or file"""
        # Try environment variables first (more secure)
        client_id = os.getenv('DATATREE_CLIENT_ID')
        client_secret = os.getenv('DATATREE_CLIENT_SECRET')
        
        if not client_id or not client_secret:
            # Fallback to credentials file
            client_id, client_secret = self._load_from_credentials_file()
        
        if not client_id or not client_secret:
            raise ValueError("DataTree credentials not found in environment or credentials file")
        
        return DataTreeConfig(
            client_id=client_id,
            client_secret=client_secret,
            timeout=int(os.getenv('DATATREE_TIMEOUT', '30')),
            max_retries=int(os.getenv('DATATREE_MAX_RETRIES', '3'))
        )
    
    def _load_email_config(self) -> EmailConfig:
        """Load email configuration from environment or file"""
        # Try environment variables first
        smtp_server = os.getenv('SMTP_SERVER')
        smtp_port = os.getenv('SMTP_PORT')
        sender_email = os.getenv('SENDER_EMAIL')
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        
        if not all([smtp_server, smtp_port, sender_email, smtp_username, smtp_password]):
            # Fallback to credentials file
            _, _, smtp_server, smtp_port, sender_email, smtp_username, smtp_password = self._load_from_credentials_file()
        
        if not all([smtp_server, smtp_port, sender_email, smtp_username, smtp_password]):
            raise ValueError("Email credentials not found in environment or credentials file")
        
        return EmailConfig(
            smtp_server=smtp_server,
            smtp_port=int(smtp_port),
            sender_email=sender_email,
            smtp_username=smtp_username,
            smtp_password=smtp_password,
            use_tls=os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'
        )
    
    def _load_from_credentials_file(self) -> tuple:
        """Load credentials from the legacy credentials.txt file"""
        credentials_path = self.data_dir / self.app_config.credentials_file
        
        if not credentials_path.exists():
            logger.warning(f"Credentials file not found: {credentials_path}")
            return tuple([None] * 7)
        
        try:
            with open(credentials_path, "r") as f:
                lines = [line.strip() for line in f.readlines()]
                
            if len(lines) < 7:
                logger.error(f"Credentials file incomplete, expected 7 lines, got {len(lines)}")
                return tuple([None] * 7)
            
            return tuple(lines)
            
        except Exception as e:
            logger.error(f"Error reading credentials file: {e}")
            return tuple([None] * 7)
    
    def load_crm_owners(self) -> list:
        """Load CRM owners with validation"""
        crm_file_path = self.data_dir / self.app_config.crm_owners_file
        
        if not crm_file_path.exists():
            logger.warning(f"CRM owners file not found: {crm_file_path}")
            return []
        
        try:
            with open(crm_file_path, "r") as f:
                content = f.read().strip()
                
            if not content:
                logger.warning("CRM owners file is empty")
                return []
            
            crm_owners = json.loads(content)
            
            # Validate and enhance CRM owner data
            validated_owners = []
            for owner in crm_owners:
                if self._validate_crm_owner(owner):
                    # Ensure required fields exist
                    if "seen_property_ids" not in owner:
                        owner["seen_property_ids"] = set()
                    else:
                        owner["seen_property_ids"] = set(owner["seen_property_ids"])
                    
                    if "states_counties" not in owner:
                        owner["states_counties"] = []
                    
                    validated_owners.append(owner)
                else:
                    logger.warning(f"Invalid CRM owner configuration: {owner.get('Name', 'Unknown')}")
            
            logger.info(f"Loaded {len(validated_owners)} valid CRM owners")
            return validated_owners
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in CRM owners file: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading CRM owners: {e}")
            return []
    
    def _validate_crm_owner(self, owner: Dict[str, Any]) -> bool:
        """Validate CRM owner configuration"""
        required_fields = ['Name', 'email', 'token']
        
        for field in required_fields:
            if not owner.get(field):
                logger.error(f"CRM owner missing required field '{field}'")
                return False
        
        # Validate email format
        email = owner.get('email', '')
        if '@' not in email:
            logger.error(f"Invalid email format for CRM owner: {email}")
            return False
        
        # Validate token format (basic check)
        token = owner.get('token', '')
        if len(token) < 50:  # JWT tokens are typically much longer
            logger.error(f"Token appears invalid for CRM owner {owner['Name']}")
            return False
        
        return True
    
    def save_crm_owners(self, crm_owners: list):
        """Save CRM owners with proper serialization"""
        crm_file_path = self.data_dir / self.app_config.crm_owners_file
        
        try:
            # Prepare data for JSON serialization
            serializable_owners = []
            for owner in crm_owners:
                owner_copy = owner.copy()
                # Convert set to list for JSON serialization
                if isinstance(owner_copy.get('seen_property_ids'), set):
                    owner_copy['seen_property_ids'] = list(owner_copy['seen_property_ids'])
                serializable_owners.append(owner_copy)
            
            # Create backup of existing file
            if crm_file_path.exists():
                backup_path = crm_file_path.with_suffix('.json.bak')
                crm_file_path.rename(backup_path)
                logger.info(f"Created backup: {backup_path}")
            
            # Write new file
            with open(crm_file_path, "w") as f:
                json.dump(serializable_owners, f, indent=4)
            
            logger.info(f"Successfully saved {len(crm_owners)} CRM owners")
            
        except Exception as e:
            logger.error(f"Error saving CRM owners: {e}")
            # Restore backup if it exists
            backup_path = crm_file_path.with_suffix('.json.bak')
            if backup_path.exists():
                backup_path.rename(crm_file_path)
                logger.info("Restored backup due to save error")
            raise


# Usage example
if __name__ == "__main__":
    config_manager = ConfigManager()
    print("DataTree Config:", config_manager.datatree_config)
    print("Email Config:", config_manager.email_config)
    print("App Config:", config_manager.app_config)
