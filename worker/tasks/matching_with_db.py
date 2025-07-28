# worker/tasks/matching_with_db.py
import os
import sys
import time
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import requests
import cloudscraper
import pandas as pd
import json
from pathlib import Path
import smtplib
import ssl
from email.message import EmailMessage
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import queue

# Add database imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database.models import create_tables
from database.service import WorkerDatabaseService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/data/worker_application.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class EnhancedPropertyMatcher:
    """Enhanced property matcher with database integration"""
    
    def __init__(self):
        self.db_service = WorkerDatabaseService()
        self.datatree_token = None
        self.performance_metrics = {
            'start_time': time.time(),
            'total_crm_owners': 0,
            'total_contacts': 0,
            'total_matches': 0,
            'total_api_calls': 0,
            'failed_api_calls': 0
        }
        
        # Load configuration from environment
        self.datatree_config = {
            'client_id': os.getenv('DATATREE_CLIENT_ID'),
            'client_secret': os.getenv('DATATREE_CLIENT_SECRET'),
            'base_url': os.getenv('DATATREE_BASE_URL', 'https://dtapiuat.datatree.com'),
            'timeout': int(os.getenv('DATATREE_TIMEOUT', '30')),
            'max_retries': int(os.getenv('DATATREE_MAX_RETRIES', '3'))
        }
        
        self.email_config = {
            'smtp_server': os.getenv('SMTP_SERVER', 'smtp.mailgun.org'),
            'smtp_port': int(os.getenv('SMTP_PORT', '587')),
            'sender_email': os.getenv('SENDER_EMAIL'),
            'smtp_username': os.getenv('SMTP_USERNAME'),
            'smtp_password': os.getenv('SMTP_PASSWORD'),
            'use_tls': os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'
        }
        
        # Ensure tables exist
        create_tables()
    
    def authenticate_datatree(self) -> str:
        """Authenticate with DataTree API"""
        url = f"{self.datatree_config['base_url']}/api/Login/AuthenticateClient"
        payload = {
            "ClientId": self.datatree_config['client_id'],
            "ClientSecretKey": self.datatree_config['client_secret']
        }
        headers = {"Content-Type": "application/json"}
        
        logger.info("Authenticating with DataTree API")
        
        try:
            response = requests.post(
                url, 
                json=payload, 
                headers=headers,
                timeout=self.datatree_config['timeout']
            )
            response.raise_for_status()
            
            token = response.text.strip().strip('"')
            if not token:
                raise ValueError("Received empty authentication token")
                
            logger.info("DataTree authentication successful")
            self.datatree_token = token
            return token
            
        except requests.exceptions.RequestException as e:
            logger.error(f"DataTree authentication failed: {e}")
            raise
    
    def fetch_contacts_from_kvcore(self, kvcore_token: str) -> List[Dict]:
        """Fetch contacts from KvCore API"""
        url = "https://api.kvcore.com/v2/public/contacts"
        headers = {
            "accept": "application/json",
            "Content-Type": "application/json",
            "authorization": f"Bearer {kvcore_token}"
        }
        
        try:
            scraper = cloudscraper.create_scraper()
            response = scraper.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            data = response.json().get("data", [])
            logger.info(f"Successfully fetched {len(data)} contacts from KvCore")
            return data
            
        except Exception as e:
            logger.error(f"Failed to fetch contacts from KvCore: {e}")
            return []
    
    def generate_name_variations(self, first_name: str, middle_name: str, last_name: str) -> List[str]:
        """Generate name variations for property search"""
        first_name = str(first_name).strip() if first_name else ""
        middle_name = str(middle_name).strip() if middle_name else ""
        last_name = str(last_name).strip() if last_name else ""

        # Validate names
        if not (first_name.isalpha() and last_name.isalpha() and (middle_name.isalpha() or not middle_name)):
            logger.warning(f"Invalid name: {last_name} {middle_name} {first_name}")
            return []

        # Exclude specific keywords
        excluded_keywords = ["", ".", " ", "user", "new", "street", "avenue"]
        if first_name.lower() in excluded_keywords or last_name.lower() in excluded_keywords:
            logger.warning(f"Invalid name: {last_name} {middle_name} {first_name}")
            return []

        variations = []
        if middle_name:
            variations.extend([
                f"{first_name} {middle_name} {last_name}",
                f"{first_name} {last_name} {middle_name}",
                f"{first_name} {last_name}",
                f"{last_name} {first_name}",
                f"{last_name} {middle_name} {first_name}"
            ])
        else:
            if len(last_name) > 1 and len(first_name) >= 2:
                variations.extend([
                    f"{first_name} {last_name}",
                    f"{last_name} {first_name}"
                ])
                
                # Add partial first name variations for longer names
                if len(first_name) >= 3:
                    for i in range(3, len(first_name) + 1):
                        variations.extend([
                            f"{last_name} {first_name[:i]}",
                            f"{first_name[:i]} {last_name}"
                        ])

        logger.debug(f"Generated {len(variations)} name variations for {first_name} {last_name}")
        return list(set(variations))  # Remove duplicates
    
    def search_datatree_properties(self, contact: Dict, crm_owner: Dict, state_fips: int = None, county_fips: int = None) -> List[Dict]:
        """Search for properties in DataTree API"""
        if not self.datatree_token:
            self.authenticate_datatree()
        
        # Parse contact name
        contact_name = contact.get('name', '').strip()
        name_parts = contact_name.split()
        
        if len(name_parts) < 2:
            logger.warning(f"Insufficient name parts for contact: {contact_name}")
            return []
        
        first_name = name_parts[0]
        last_name = name_parts[-1]
        middle_name = name_parts[1] if len(name_parts) == 3 else ""
        
        # Generate name variations
        name_variations = self.generate_name_variations(first_name, middle_name, last_name)
        if not name_variations:
            return []
        
        # Search parameters
        six_months_ago = datetime.now() - timedelta(days=180)
        formatted_date = six_months_ago.strftime('%Y-%m-%d')
        
        all_properties = []
        url = f"{self.datatree_config['base_url']}/api/Report/GetReport"
        headers = {
            "Authorization": f"Bearer {self.datatree_token}",
            "Content-Type": "application/json"
        }
        
        # Log search operation
        search_params = {
            'contact_name': contact_name,
            'state_fips': state_fips,
            'county_fips': county_fips,
            'search_date_from': formatted_date,
            'name_variations_count': len(name_variations)
        }
        
        search_log = self.db_service.log_search_operation(
            crm_owner, 'property_search', search_params
        )
        
        properties_found = 0
        api_calls_made = 0
        
        try:
            for name_variation in name_variations:
                # Build filters
                filters = [
                    {"FilterName": "SellerName", "FilterOperator": "contains", "FilterValues": [name_variation]},
                    {"FilterName": "SaleDate", "FilterOperator": "is after", "FilterValues": [formatted_date]}
                ]
                
                if state_fips:
                    filters.append({"FilterName": "StateFips", "FilterOperator": "is", "FilterValues": [str(state_fips)]})
                if county_fips:
                    filters.append({"FilterName": "CountyFips", "FilterOperator": "is", "FilterValues": [str(county_fips)]})
                
                payload = {
                    "ProductNames": ["PropertyDetailReport"],
                    "SearchType": "Filter",
                    "SearchRequest": {
                        "ReferenceId": "1",
                        "ProductName": "SearchLite",
                        "MaxReturn": "100",
                        "Filters": filters
                    }
                }
                
                try:
                    response = requests.post(
                        url, 
                        json=payload, 
                        headers=headers, 
                        timeout=self.datatree_config['timeout']
                    )
                    api_calls_made += 1
                    self.performance_metrics['total_api_calls'] += 1
                    
                    if response.status_code == 400:
                        error_response = response.json()
                        if error_response.get("Message") == "No matching property found.":
                            logger.debug(f"No properties found for name variation: {name_variation}")
                            continue
                        else:
                            logger.warning(f"400 Error for name '{name_variation}': {error_response}")
                            continue
                    
                    response.raise_for_status()
                    data = response.json()
                    
                    if "LitePropertyList" in data and data["LitePropertyList"]:
                        properties = data["LitePropertyList"]
                        properties_found += len(properties)
                        
                        # Process each property
                        for prop in properties:
                            property_details = self.fetch_property_details(prop.get("PropertyId"))
                            if property_details:
                                property_details.update({
                                    'Contact Name': contact_name,
                                    'Contact Email': contact.get('email', ''),
                                    'Name Variation Used': name_variation,
                                    'Match Confidence': self.calculate_match_confidence(name_variation, contact_name),
                                    'Search Criteria': search_params
                                })
                                all_properties.append(property_details)
                        
                        logger.info(f"Found {len(properties)} properties for {name_variation}")
                
                except requests.exceptions.RequestException as e:
                    logger.error(f"API error for name variation '{name_variation}': {e}")
                    self.performance_metrics['failed_api_calls'] += 1
                    continue
                
                # Rate limiting
                time.sleep(0.1)
            
            # Update search log with results
            search_log.results_count = properties_found
            search_log.new_matches_count = len(all_properties)
            search_log.api_calls_made = api_calls_made
            search_log.mark_completed(success=True)
            
            logger.info(f"Search completed for {contact_name}: {len(all_properties)} total matches found")
            return all_properties
            
        except Exception as e:
            logger.error(f"Error in property search for {contact_name}: {e}")
            search_log.mark_completed(success=False, error_message=str(e))
            self.performance_metrics['failed_api_calls'] += 1
            return []
    
    def fetch_property_details(self, property_id: str) -> Optional[Dict]:
        """Fetch detailed property information"""
        if not property_id:
            return None
            
        url = f"{self.datatree_config['base_url']}/api/Report/GetReport"
        headers = {
            "Authorization": f"Bearer {self.datatree_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "ProductNames": ["PropertyDetailReport"],
            "SearchType": "PROPERTY",
            "PropertyId": property_id
        }

        try:
            response = requests.post(
                url, 
                json=payload, 
                headers=headers, 
                timeout=self.datatree_config['timeout']
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get("Reports"):
                property_report = data["Reports"][0]
                report_data = property_report.get("Data", {})
                subject_property = report_data.get("SubjectProperty", {})
                owner_info = report_data.get("OwnerInformation", {})
                transfer_info = report_data.get("OwnerTransferInformation", {})

                return {
                    "Property ID": property_id,
                    "Owner Name": owner_info.get("OwnerNames", "N/A"),
                    "Street Address": subject_property.get("SitusAddress", {}).get("StreetAddress", "N/A"),
                    "County": subject_property.get("SitusAddress", {}).get("County", "N/A"),
                    "State": subject_property.get("SitusAddress", {}).get("State", "N/A"),
                    "Seller Name": transfer_info.get("SellerName", "N/A"),
                    "Sale Date": transfer_info.get("SaleDate", "N/A"),
                    "Sale Price": transfer_info.get("SalePrice", "N/A")
                }
            return None

        except Exception as e:
            logger.error(f"Error fetching property details for PropertyId {property_id}: {e}")
            return None
    
    def calculate_match_confidence(self, name_variation: str, original_name: str) -> float:
        """Calculate confidence score for name match"""
        if not name_variation or not original_name:
            return 0.0
        
        # Simple confidence calculation based on name similarity
        variation_words = set(name_variation.lower().split())
        original_words = set(original_name.lower().split())
        
        if not variation_words or not original_words:
            return 0.0
        
        intersection = len(variation_words.intersection(original_words))
        union = len(variation_words.union(original_words))
        
        confidence = (intersection / union) * 100 if union > 0 else 0.0
        return round(confidence, 2)
    
    def process_crm_owner(self, crm_owner: Dict, task_id: str = None) -> Dict[str, Any]:
        """Process a single CRM owner"""
        logger.info(f"Processing CRM owner: {crm_owner.get('Name')}")
        
        owner_metrics = {
            'name': crm_owner.get('Name'),
            'contacts_processed': 0,
            'properties_found': 0,
            'api_calls_made': 0,
            'start_time': time.time()
        }
        
        try:
            # Fetch contacts from KvCore
            contacts = self.fetch_contacts_from_kvcore(crm_owner.get('token'))
            if not contacts:
                logger.warning(f"No contacts found for {crm_owner.get('Name')}")
                return owner_metrics
            
            logger.info(f"Found {len(contacts)} contacts for {crm_owner.get('Name')}")
            self.performance_metrics['total_contacts'] += len(contacts)
            
            all_matches = []
            states_counties = crm_owner.get('states_counties', [])
            
            # Process contacts with threading
            with ThreadPoolExecutor(max_workers=5) as executor:
                future_to_contact = {}
                
                for contact in contacts:
                    if not self.validate_contact(contact):
                        continue
                    
                    # Submit search tasks
                    if states_counties:
                        for state_county in states_counties:
                            future = executor.submit(
                                self.search_datatree_properties,
                                contact,
                                crm_owner,
                                state_county.get('state_FIPS'),
                                state_county.get('county_FIPS')
                            )
                            future_to_contact[future] = contact
                    else:
                        future = executor.submit(
                            self.search_datatree_properties,
                            contact,
                            crm_owner
                        )
                        future_to_contact[future] = contact
                
                # Collect results
                for future in as_completed(future_to_contact):
                    contact = future_to_contact[future]
                    try:
                        contact_matches = future.result()
                        if contact_matches:
                            all_matches.extend(contact_matches)
                        owner_metrics['contacts_processed'] += 1
                    except Exception as e:
                        logger.error(f"Error processing contact {contact.get('name')}: {e}")
            
            # Filter out already seen properties
            seen_property_ids = crm_owner.get('seen_property_ids', set())
            new_matches = [
                match for match in all_matches 
                if match.get('Property ID') not in seen_property_ids
            ]
            
            owner_metrics['properties_found'] = len(new_matches)
            self.performance_metrics['total_matches'] += len(new_matches)
            
            if new_matches:
                # Save matches to database
                saved_matches = self.db_service.save_property_matches_batch(
                    new_matches, crm_owner, task_id
                )
                
                # Update seen property IDs
                new_property_ids = [match.get('Property ID') for match in new_matches]
                self.db_service.update_crm_owner_seen_properties(
                    crm_owner.get('id'), new_property_ids
                )
                
                # Send email with results
                self.send_results_email(crm_owner, new_matches, task_id)
                
                logger.info(f"Processed {crm_owner.get('Name')}: {len(new_matches)} new matches found")
            else:
                logger.info(f"No new matches found for {crm_owner.get('Name')}")
            
            owner_metrics['end_time'] = time.time()
            owner_metrics['duration'] = owner_metrics['end_time'] - owner_metrics['start_time']
            
            return owner_metrics
            
        except Exception as e:
            logger.error(f"Error processing CRM owner {crm_owner.get('Name')}: {e}")
            owner_metrics['error'] = str(e)
            return owner_metrics
    
    def validate_contact(self, contact: Dict) -> bool:
        """Validate contact data"""
        if not contact.get('name') or not contact.get('email'):
            return False
        
        name = contact.get('name', '').strip()
        email = contact.get('email', '').strip()
        
        # Basic validation
        if len(name) < 2 or '@' not in email:
            return False
        
        # Check for invalid names
        invalid_names = ['user', 'test', 'new', 'street', 'avenue']
        if any(invalid in name.lower() for invalid in invalid_names):
            return False
        
        return True
    
    def send_results_email(self, crm_owner: Dict, matches: List[Dict], task_id: str = None):
        """Send email with property matches"""
        if not matches:
            return
        
        try:
            # Create Excel file
            df = pd.DataFrame(matches)
            timestamp = datetime.now().strftime('%b_%Y').lower()
            filename = f"matches_{timestamp}_{crm_owner.get('Name', 'unknown')}.xlsx"
            filepath = f"/tmp/{filename}"
            
            df.to_excel(filepath, index=False, engine='openpyxl')
            
            # Prepare email
            subject = f"Your Monthly Property Matches - {len(matches)} Found"
            body = f"""
            <html>
                <body>
                    <p>Hi {crm_owner.get('Name')},</p>
                    <p>We found {len(matches)} property matches in your client database.</p>
                    <p>Please find the detailed report attached.</p>
                    <br>
                    <p>Best regards,</p>
                    <p>Real Estate Client Tracker Team</p>
                </body>
            </html>
            """
            
            # Send email
            msg = EmailMessage()
            msg["From"] = self.email_config['sender_email']
            msg["To"] = crm_owner.get('email')
            msg["Subject"] = subject
            msg.set_content("Please see the attached property matches report.", subtype="plain")
            msg.add_alternative(body, subtype="html")
            
            # Attach file
            with open(filepath, "rb") as f:
                msg.add_attachment(
                    f.read(), 
                    maintype="application", 
                    subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    filename=filename
                )
            
            # Send email
            context = ssl.create_default_context()
            with smtplib.SMTP(self.email_config['smtp_server'], self.email_config['smtp_port']) as server:
                if self.email_config['use_tls']:
                    server.starttls(context=context)
                server.login(self.email_config['smtp_username'], self.email_config['smtp_password'])
                server.send_message(msg)
            
            # Log email notification
            file_size = os.path.getsize(filepath)
            attachment_info = {'filename': filename, 'size': file_size}
            
            self.db_service.log_email_notification(
                crm_owner, 
                'monthly_matches', 
                subject, 
                len(matches),
                attachment_info,
                task_id
            )
            
            logger.info(f"Email sent successfully to {crm_owner.get('email')}")
            
            # Clean up temp file
            os.remove(filepath)
            
        except Exception as e:
            logger.error(f"Error sending email to {crm_owner.get('email')}: {e}")
    
    def run_matching_process(self, task_id: str = None) -> Dict[str, Any]:
        """Run the complete matching process"""
        logger.info("Starting property matching process")
        
        # Create worker status record
        if task_id:
            worker_status = self.db_service.create_worker_task_status(task_id, 'property_matching')
        
        try:
            # Get CRM owners from database
            crm_owners = self.db_service.get_all_crm_owners()
            if not crm_owners:
                logger.warning("No CRM owners found in database")
                return {'status': 'no_owners', 'message': 'No CRM owners found'}
            
            logger.info(f"Found {len(crm_owners)} CRM owners to process")
            self.performance_metrics['total_crm_owners'] = len(crm_owners)
            
            # Update worker status
            if task_id:
                self.db_service.update_worker_task_progress(
                    task_id, 
                    total_crm_owners=len(crm_owners)
                )
            
            # Authenticate with DataTree
            self.authenticate_datatree()
            
            # Process each CRM owner
            owner_results = []
            processed_count = 0
            
            for crm_owner in crm_owners:
                try:
                    owner_metrics = self.process_crm_owner(crm_owner, task_id)
                    owner_results.append(owner_metrics)
                    processed_count += 1
                    
                    # Update progress
                    if task_id:
                        self.db_service.update_worker_task_progress(
                            task_id,
                            processed_crm_owners=processed_count,
                            total_contacts=self.performance_metrics['total_contacts'],
                            total_matches_found=self.performance_metrics['total_matches'],
                            total_api_calls=self.performance_metrics['total_api_calls']
                        )
                    
                    logger.info(f"Completed {processed_count}/{len(crm_owners)} CRM owners")
                    
                except Exception as e:
                    logger.error(f"Error processing CRM owner {crm_owner.get('Name')}: {e}")
                    continue
            
            # Calculate final metrics
            end_time = time.time()
            self.performance_metrics['end_time'] = end_time
            self.performance_metrics['duration'] = end_time - self.performance_metrics['start_time']
            
            result = {
                'status': 'completed',
                'processed_owners': processed_count,
                'total_contacts': self.performance_metrics['total_contacts'],
                'total_matches': self.performance_metrics['total_matches'],
                'total_api_calls': self.performance_metrics['total_api_calls'],
                'duration_seconds': self.performance_metrics['duration'],
                'owner_results': owner_results
            }
            
            # Complete worker status
            if task_id:
                self.db_service.complete_worker_task(
                    task_id, 
                    'completed', 
                    performance_metrics=self.performance_metrics
                )
            
            logger.info(f"Property matching process completed: {result}")
            return result
            
        except Exception as e:
            error_msg = f"Fatal error in matching process: {e}"
            logger.error(error_msg)
            
            # Mark task as failed
            if task_id:
                self.db_service.complete_worker_task(task_id, 'failed', error_msg)
            
            return {
                'status': 'failed',
                'error': error_msg,
                'performance_metrics': self.performance_metrics
            }

def run_matching_algorithm() -> Dict[str, Any]:
    """Main entry point for the matching algorithm"""
    matcher = EnhancedPropertyMatcher()
    return matcher.run_matching_process()

# Task wrapper for Celery
def run_matching_task(task_id: str = None) -> Dict[str, Any]:
    """Celery task wrapper"""
    matcher = EnhancedPropertyMatcher()
    return matcher.run_matching_process(task_id)

if __name__ == "__main__":
    # For direct execution
    result = run_matching_algorithm()
    print(f"Matching process result: {result}")
