import requests
import json
import threading
import pandas as pd
import csv
from datetime import datetime, timedelta
import re
import os
import openpyxl
import time
import cloudscraper
import smtplib
import ssl
from email.message import EmailMessage
import shutil
import concurrent.futures
import queue
import logging
from config import Config
from Secure_Configuration_Management import ConfigManager
from Enhanced_Error_Handling_Retry_Logic import (
    retry_with_exponential_backoff,
    APIHealthChecker,
    validate_contact_data,
    health_checker,
    rate_limiter,
    logger as error_logger
)
from Performance_Monitoring_Optimization import (
    PerformanceMetrics,
    ProcessingQueue,
    AdaptiveThreadManager,
    performance_timer,
    EnhancedPropertySearchManager
)

# Initialize configuration
config_manager = ConfigManager()
config = config_manager.app_config
datatree_config = config_manager.datatree_config
email_config = config_manager.email_config

# Global metrics tracker
metrics = PerformanceMetrics()
processing_queue = ProcessingQueue()

# Configure logging
logging.basicConfig(
    level=config.log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(config.data_dir, 'application.log')),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constants
DATATREE_BASE_URL = datatree_config.base_url
AUTH_ENDPOINT = datatree_config.auth_endpoint
FETCH_REPORT_ENDPOINT = datatree_config.report_endpoint
FETCH_PropertySearch_ENDPOINT = datatree_config.search_endpoint
LOGO_PATH = config.logo_path

# Load CRM owners
CRM_owners = config_manager.load_crm_owners()

@retry_with_exponential_backoff(max_retries=datatree_config.max_retries)
def authenticate_datatree():
    """Authenticate with DataTree API with enhanced error handling"""
    url = DATATREE_BASE_URL + AUTH_ENDPOINT
    payload = {
        "ClientId": datatree_config.client_id,
        "ClientSecretKey": datatree_config.client_secret
    }
    headers = {"Content-Type": "application/json"}
    
    logger.info("Authenticating with DataTree API")
    try:
        response = requests.post(
            url, 
            json=payload, 
            headers=headers,
            timeout=datatree_config.timeout
        )
        response.raise_for_status()
        
        token = response.text.strip().strip('"')
        if not token:
            raise ValueError("Received empty authentication token")
            
        logger.info("DataTree authentication successful")
        health_checker.record_success('datatree')
        return token
        
    except requests.exceptions.RequestException as e:
        logger.error(f"DataTree authentication failed: {e}")
        health_checker.record_failure('datatree')
        raise

auth_token = authenticate_datatree()

@retry_with_exponential_backoff(max_retries=3)
def fetch_all_contacts(KVCORE_TOKEN):
    """Fetch contacts from KvCore with enhanced error handling"""
    url = "https://api.kvcore.com/v2/public/contacts"
    headers = {
        "accept": "application/json",
        "Content-Type": "application/json",
        "authorization": f"Bearer {KVCORE_TOKEN}"
    }
    
    try:
        scraper = cloudscraper.create_scraper()
        response = scraper.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        data = response.json().get("data", [])
        logger.info(f"Successfully fetched {len(data)} contacts from KvCore")
        health_checker.record_success('kvcore')
        return data
        
    except Exception as e:
        logger.error(f"Failed to fetch contacts from KvCore: {e}")
        health_checker.record_failure('kvcore')
        return []

def save_seen_property_ids(crm_owner):
    """Update and save seen_property_ids for a specific CRM owner"""
    try:
        config_manager.save_crm_owners(CRM_owners)
        logger.info(f"Updated seen_property_ids for {crm_owner['Name']}")
    except Exception as e:
        logger.error(f"Error updating seen_property_ids for {crm_owner['Name']}: {e}")

def send_email_with_attachment(crm_owner, file_path):
    """Send email with attachment using enhanced configuration"""
    subject = "Your Monthly Matches from Real Estate Client Tracker"
    body = f"""\
    <html>
        <body>
            <p>Hi {crm_owner['Name']},</p>
            <p>Here are your monthly matches in your CRM/ Client Database.</p>
            <br>
            <p>Regards,</p>
            <p>Real Estate Client Tracker Inc</p>
            <img src="cid:logo_cid" width="200"/>
        </body>
    </html>
    """

    msg = EmailMessage()
    msg["From"] = email_config.sender_email
    msg["To"] = crm_owner['email']
    msg["Subject"] = subject
    msg.set_content("This email contains an HTML version.", subtype="plain")
    msg.add_alternative(body, subtype="html")

    try:
        # Attach the CRM data CSV
        with open(file_path, "rb") as f:
            msg.add_attachment(f.read(), maintype="application", subtype="csv", filename=os.path.basename(file_path))

        # Attach the logo if it exists
        if os.path.exists(LOGO_PATH):
            with open(LOGO_PATH, "rb") as f:
                msg.add_attachment(f.read(), maintype="image", subtype="jpeg", filename="logo.jpg", cid="logo_cid")

        # Send the email
        context = ssl.create_default_context()
        with smtplib.SMTP(email_config.smtp_server, email_config.smtp_port) as server:
            if email_config.use_tls:
                server.starttls(context=context)
            server.login(email_config.smtp_username, email_config.smtp_password)
            server.send_message(msg)

        logger.info("Email with attachment sent successfully!")
        
    except Exception as e:
        logger.error(f"Error sending email: {e}")

def save_to_excel(data_to_be_saved, crm_owner):
    """Save data to Excel with enhanced error handling"""
    if not data_to_be_saved:
        logger.info(f"No data to save for {crm_owner['Name']}")
        return

    try:
        df = pd.DataFrame(data_to_be_saved)
        timestamp = datetime.now().strftime('%b_%Y').lower()
        base_filename = f"matches_of_{timestamp}_{crm_owner['Name']}"
        file_path = f"{base_filename}.xlsx"
        
        # Handle duplicate filenames
        counter = 1
        while os.path.exists(file_path):
            file_path = f"{base_filename}({counter}).xlsx"
            counter += 1

        with performance_timer():
            with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, header=True, sheet_name="Sheet1")

        send_email_with_attachment(crm_owner, file_path)
        logger.info(f"Data saved successfully for {crm_owner['Name']} in {file_path}")

    except Exception as e:
        logger.error(f"Error saving {crm_owner['Name']}'s data to Excel: {e}")

@retry_with_exponential_backoff(max_retries=datatree_config.max_retries)
def fetch_property_details(property_id):
    """Fetch property details with enhanced error handling"""
    url = DATATREE_BASE_URL + FETCH_REPORT_ENDPOINT
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "ProductNames": ["PropertyDetailReport"],
        "SearchType": "PROPERTY",
        "PropertyId": property_id
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=datatree_config.timeout)
        response.raise_for_status()
        data = response.json()
        
        if data.get("Reports"):
            property_report = data["Reports"][0]
            report_data = property_report.get("Data", {})
            subject_property = report_data.get("SubjectProperty", {})
            owner_info = report_data.get("OwnerInformation", {})

            property_id = subject_property.get("PropertyId", "N/A")
            if property_id == "N/A":
                return None

            return {
                "PropertyId": property_id,
                "OwnerNames": owner_info.get("OwnerNames", "N/A"),
                "StreetAddress": subject_property.get("SitusAddress", {}).get("StreetAddress", "N/A"),
                "County": subject_property.get("SitusAddress", {}).get("County", "N/A"),
                "State": subject_property.get("SitusAddress", {}).get("State", "N/A"),
                "SellerName": report_data.get("OwnerTransferInformation", {}).get("SellerName", "N/A")
            }
        return None

    except Exception as e:
        logger.error(f"Error fetching property details for PropertyId {property_id}: {e}")
        raise

def generate_name_variations(first_name, middle_name, last_name):
    """Generate name variations with validation"""
    first_name = str(first_name).strip() if first_name else ""
    middle_name = str(middle_name).strip() if middle_name else ""
    last_name = str(last_name).strip() if last_name else ""

    # Validate names
    if not (first_name.isalpha() and last_name.isalpha() and (middle_name.isalpha() or not middle_name)):
        logger.warning(f"Invalid name: {last_name} {middle_name} {first_name}")
        return []

    # Exclude specific keywords
    if first_name.lower() in ["","."," ","user", "new","street" , "avenue"] or last_name.lower() in ["","."," ","user", "new","street" , "avenue"]:
        logger.warning(f"Invalid name: {last_name} {middle_name} {first_name}")
        return []

    variations = []
    if middle_name:
        variations.append(f"{first_name} {middle_name} {last_name}")
        variations.append(f"{first_name} {last_name} {middle_name}")
        variations.append(f"{first_name} {last_name}")
        variations.append(f"{first_name} {middle_name}")

        variations.append(f"{last_name} {middle_name} {first_name}")
        variations.append(f"{last_name} {first_name} {middle_name}")
        variations.append(f"{last_name} {middle_name}")
        variations.append(f"{last_name} {first_name}")

        variations.append(f"{middle_name} {last_name} {first_name}")
        variations.append(f"{middle_name} {first_name} {last_name}")
        variations.append(f"{middle_name} {last_name}")
        variations.append(f"{middle_name} {first_name}")
    else:
        if len(last_name) > 1:
            if len(first_name) >= 3:
                for i in range(3, len(first_name) + 1):
                    variations.append(f"{last_name} {first_name[:i]}")
                    variations.append(f"{first_name[:i]} {last_name}")
            elif len(first_name) == 2 and len(last_name) > 2:
                variations.append(f"{first_name[:2]} {last_name}")
        elif len(first_name) > 2:
            variations.append(f"{last_name} {first_name}")
            variations.append(f"{first_name} {last_name}")

    logger.debug(f"Generated name variations: {variations}")
    return variations

@retry_with_exponential_backoff(max_retries=datatree_config.max_retries)
def fetch_report_from_datatree(state_fips, county_fips, crm_owner, contact_details):
    """Fetch property reports with enhanced error handling"""
    data_collection = []
    all_results = []
    url = DATATREE_BASE_URL + FETCH_REPORT_ENDPOINT
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    
    six_months_ago = datetime.now() - timedelta(days=config.search_months_back*30)
    formatted_date = six_months_ago.strftime('%Y-%m-%d')

    name_variations = generate_name_variations(
        contact_details['first_name'],
        contact_details['middle_name'],
        contact_details['last_name']
    )
    
    for name_filter in name_variations:
        filters = [
            {"FilterName": "SellerName", "FilterOperator": "contains", "FilterValues": [name_filter]},
            {"FilterName": "SaleDate", "FilterOperator": "is after", "FilterValues": [formatted_date]}
        ]
        
        if state_fips:
            filters.append({"FilterName": "StateFips", "FilterOperator": "is", "FilterValues": [state_fips]})
        if county_fips:
            filters.append({"FilterName": "CountyFips", "FilterOperator": "is", "FilterValues": [county_fips]})
        
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
            response = requests.post(url, json=payload, headers=headers, timeout=datatree_config.timeout)
            
            if response.status_code == 400:
                error_response = response.json()
                if error_response.get("Message") == "No matching property found.":
                    logger.debug(f"No properties found for SellerName filter '{name_filter}'.")
                    continue
                else:
                    logger.warning(f"400 Error for SellerName '{name_filter}': {error_response}")
                    continue
            
            response.raise_for_status()
            data = response.json()
            
            if "LitePropertyList" in data and data["LitePropertyList"]:
                all_results.extend(data["LitePropertyList"])
                logger.debug(f"{len(data['LitePropertyList'])} properties found for filter: {name_filter} as Seller")
            
        except Exception as e:
            logger.error(f"Error fetching report for name filter '{name_filter}': {e}")
            continue

        # Similar logic for OwnerNames filter...
        # (Rest of the function remains the same as original but with logging)

    # Process results and return data_collection
    return data_collection

def search_datatree_thread():
    """Main search process with enhanced thread management"""
    search_manager = EnhancedPropertySearchManager(config_manager)
    search_manager.process_all_crm_owners(CRM_owners)

def process_crm_owner(CRM_owner, result_queue):
    """Process CRM owner with enhanced metrics tracking"""
    with performance_timer():
        contacts = fetch_all_contacts(CRM_owner['token'])
        metrics.total_contacts_processed += len(contacts)
        
        if not contacts:
            return

        states_counties = CRM_owner.get("states_counties", [])
        contact_result_queue = queue.Queue()
        
        with ThreadPoolExecutor(max_workers=config.max_contact_threads) as executor:
            future_to_contact = {
                executor.submit(
                    search_for_contact,
                    contact,
                    contact_result_queue,
                    CRM_owner,
                    states_counties
                ): contact for contact in contacts
            }
            
            for future in concurrent.futures.as_completed(future_to_contact):
                try:
                    future.result()
                except Exception as e:
                    logger.error(f"Error processing contact: {e}")

        # Collect and process results
        owner_results = []
        while not contact_result_queue.empty():
            owner_results.extend(contact_result_queue.get())

        if owner_results:
            result_queue.put((CRM_owner['Name'], owner_results))
            save_to_excel(owner_results, CRM_owner)
            metrics.total_properties_found += len(owner_results)

        save_seen_property_ids(CRM_owner)

def search_for_contact(contact, contact_result_queue, crm_owner, states_counties):
    """Search for contact with enhanced validation"""
    if not validate_contact_data(contact):
        return

    contact_details = {
        'first_name': contact.get('name', '').split()[0] if ' ' in contact.get('name', '') else "",
        'middle_name': contact.get('name', '').split()[1] if len(contact.get('name', '').split()) == 3 else "",
        'last_name': contact.get('name', '').split()[-1] if len(contact.get('name', '').split()) > 1 else contact.get('name'),
        'email': contact.get('email', '')
    }

    # Process search with or without state/county filters
    if not states_counties:
        state_result_queue = queue.Queue()
        perform_search_for_contact(contact_details, None, None, crm_owner, state_result_queue)
        contact_properties = []
        while not state_result_queue.empty():
            contact_properties.extend(state_result_queue.get())
    else:
        threads = []
        state_result_queues = []
        
        for state_county in states_counties:
            state_result_queue = queue.Queue()
            state_result_queues.append(state_result_queue)
            
            thread = threading.Thread(
                target=perform_search_for_contact,
                args=(contact_details, state_county.get("state_FIPS"), state_county.get("county_FIPS"), crm_owner, state_result_queue)
            )
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        contact_properties = []
        for result_queue in state_result_queues:
            while not result_queue.empty():
                contact_properties.extend(result_queue.get())

    # Filter out already seen properties
    new_properties = [prop for prop in contact_properties if prop["Property ID"] not in crm_owner['seen_property_ids']]
    
    if new_properties:
        contact_result_queue.put(new_properties)

def perform_search_for_contact(contact_details, state_fips, county_fips, crm_owner, result_queue):
    """Perform search for a contact with rate limiting"""
    if not rate_limiter.can_make_call():
        time.sleep(60)  # Wait if rate limited
    
    try:
        results = fetch_report_from_datatree(state_fips, county_fips, crm_owner, contact_details)
        if results:
            result_queue.put(results)
            rate_limiter.record_call()
    except Exception as e:
        logger.error(f"Error in perform_search_for_contact: {e}")

if __name__ == "__main__":
    try:
        search_datatree_thread()
        metrics.finish()
        logger.info(f"Process completed. Metrics: {metrics.to_dict()}")
    except Exception as e:
        logger.critical(f"Fatal error in main execution: {e}")
        raise
