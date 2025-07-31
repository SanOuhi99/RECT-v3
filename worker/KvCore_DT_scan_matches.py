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
import os
import shutil
from sqlalchemy import create_engine, Column, Integer, String, JSON, text, DateTime
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.sql import func
from dotenv import load_dotenv
from passlib.context import CryptContext
from datetime import datetime



# Load environment variables
load_dotenv()
def should_run_this_month():
    today = datetime.today()

    # Get current month number (e.g., 7 for July)
    current_month = today.month

    # Read last run month from env
    last_run_month = int(os.getenv("LAST_RUN_MONTH", "0"))

    # Must be a weekday (Mon–Fri)
    if today.weekday() > 5:
        return False

    # Is there any earlier weekday this month?
    for i in range(1, today.day):
        d = datetime(today.year, today.month, i)
        if d.weekday() < 5:
            return False  # Not first weekday

    if current_month == last_run_month:
        print("Already ran this month.")
        return False

    return True

if not should_run_this_month():
    print("Exiting — not first weekday or already ran.")
    exit(0)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("DATABASE_URL environment variable not set")

# Database setup
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=0,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# Database Models
class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    companycode = Column(String, nullable=False, unique=True, index=True)
    password = Column(String, nullable=False)

class StatesCounties(Base):
    __tablename__ = "states_counties"
    statefips = Column(Integer, primary_key=True)
    state = Column(String, nullable=False)
    countyfips = Column(Integer, primary_key=True)
    county = Column(String, nullable=False)

class CrmOwner(Base):
    __tablename__ = "crm_owners"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    token = Column(String, nullable=False)
    companycode = Column(String, nullable=False)
    password = Column(String, nullable=False)
    seen_property_ids = Column(JSON, nullable=True)
    states_counties = Column(JSON, nullable=True)

class SeenProperties(Base):
    __tablename__ = "seen_properties"
    id = Column(Integer, primary_key=True, index=True)
    crm_owner_id = Column(Integer, nullable=False)
    property_id = Column(String, nullable=False)
    owner_name = Column(String)
    street_address = Column(String)
    county = Column(String)
    state = Column(String)
    seller_name = Column(String)
    contact_email = Column(String)
    contact_first_name = Column(String)
    contact_last_name = Column(String)
    contact_middle_name = Column(String)
    name_variation = Column(String)
    created_at = Column(DateTime, server_default=func.now())

# Create database session
def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # Don't close here, close manually when done

DATA_DIR = "/app/data"
credentials_FILE = os.path.join(DATA_DIR, "credentials.txt")
DATATREE_BASE_URL = "https://dtapiuat.datatree.com"
AUTH_ENDPOINT = "/api/Login/AuthenticateClient"
FETCH_REPORT_ENDPOINT = "/api/Report/GetReport"
FETCH_PropertySearch_ENDPOINT = "/api/Search/PropertySearch"

# Ensure the directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# If the credentials file doesn't exist in Railway Volume, copy it from the repo
if not os.path.exists(credentials_FILE):
    shutil.copy("credentials.txt", credentials_FILE)
    print("Copied credentials.txt to Railway Volume.")
else:
    print("credentials.txt exists in Railway Volume.")

with open(credentials_FILE, "r") as f:
    lines = f.readlines()
    CLIENT_ID = os.getenv("DATATREE_CLIENT_ID")
    CLIENT_SECRET = os.getenv("DATATREE_CLIENT_SECRET")
    SMTP_SERVER = os.getenv("SMTP_SERVER")
    SMTP_PORT = os.getenv("SMTP_PORT")
    SENDER_EMAIL = os.getenv("SENDER_EMAIL")
    SMTP_USERNAME = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

def load_crm_owners():
    """Load CRM owners from the database and ensure they have seen_property_ids as sets."""
    db = get_db()
    try:
        crm_owners = db.query(CrmOwner).all()
        
        owners_list = []
        for owner in crm_owners:
            owner_dict = {
                "id": owner.id,
                "Name": owner.name,
                "email": owner.email,
                "token": owner.token,
                "companycode": owner.companycode,
                "password": owner.password,
                "seen_property_ids": set(owner.seen_property_ids) if owner.seen_property_ids else set(),
                "states_counties": owner.states_counties if owner.states_counties else []
            }
            owners_list.append(owner_dict)
        
        print(f"Loaded {len(owners_list)} CRM owners from database")
        return owners_list
        
    except Exception as e:
        print(f"Error loading CRM owners from database: {e}")
        return []
    finally:
        db.close()

def save_seen_property_ids(crm_owner):
    """
    Update and save seen_property_ids for a specific CRM owner in the database.
    """
    db = get_db()
    try:
        # Find the CRM owner in the database
        db_owner = db.query(CrmOwner).filter(CrmOwner.id == crm_owner["id"]).first()
        
        if db_owner:
            # Convert set to list for JSON storage
            db_owner.seen_property_ids = list(crm_owner['seen_property_ids'])
            db.commit()
            print(f"Updated seen_property_ids for {crm_owner['Name']} in database")
        else:
            print(f"CRM owner {crm_owner['Name']} not found in database")
            
    except Exception as e:
        print(f"Error updating seen_property_ids for {crm_owner['Name']}: {e}")
        db.rollback()
    finally:
        db.close()

def save_property_to_seen_properties(crm_owner_id, property_data, contact_details):
    """
    Save a property match to the seen_properties table.
    """
    db = get_db()
    try:
        seen_property = SeenProperties(
            crm_owner_id=crm_owner_id,
            property_id=property_data.get("Property ID"),
            owner_name=property_data.get("Owner Name"),
            street_address=property_data.get("Street Address"),
            county=property_data.get("County"),
            state=property_data.get("State"),
            seller_name=property_data.get("Seller Name"),
            contact_email=contact_details.get("email"),
            contact_first_name=contact_details.get("first_name"),
            contact_last_name=contact_details.get("last_name"),
            contact_middle_name=contact_details.get("middle_name"),
            name_variation=property_data.get("Name Variation")
        )
        
        db.add(seen_property)
        db.commit()
        print(f"Saved property {property_data.get('Property ID')} to seen_properties table")
        
    except Exception as e:
        print(f"Error saving property to seen_properties table: {e}")
        db.rollback()
    finally:
        db.close()

# Load CRM owners from database
CRM_owners = load_crm_owners()

# Get the directory of the current script
def get_script_directory():
    return os.path.dirname(os.path.abspath(__file__))

def is_file_open(file_path):
    """Check if a file is currently open in another program."""
    if not os.path.exists(file_path):
        return False
    try:
        with open(file_path, "a"):  # Try opening the file in append mode
            return False
    except IOError:
        return True

# Define the logo file path
LOGO_PATH = "/app/data/logo.jpg"

def send_email_with_attachment(crm_owner, file_path):
    subject = "Your Monthly Matches from Real Estate Client Tracker"
    
    # Email body
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
    msg["From"] = SENDER_EMAIL
    msg["To"] = crm_owner['email']
    msg["Subject"] = subject
    msg.set_content("This email contains an HTML version.", subtype="plain")
    msg.add_alternative(body, subtype="html")

    # Attach the CRM data CSV
    file_name = os.path.basename(file_path)
    try:
        with open(file_path, "rb") as f:
            msg.add_attachment(f.read(), maintype="application", subtype="csv", filename=file_name)

        # Attach the logo
        with open(LOGO_PATH, "rb") as f:
            msg.add_attachment(f.read(), maintype="image", subtype="jpeg", filename="logo.jpg", cid="logo_cid")

        # Send the email
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

        print("(V) Email with attachment and logo sent successfully!")
    
    except FileNotFoundError as e:
        print(f"(X) File not found: {e}")
    except smtplib.SMTPAuthenticationError:
        print("(X) SMTP Authentication Error: Check your email credentials.")
    except smtplib.SMTPException as e:
        print(f"(X) SMTP Error: {e}")
    except Exception as e:
        print(f"(X) Unexpected error: {e}")

def save_to_excel(data_to_be_saved, crm_owner):
    """
    Save the collected data to an Excel file, handling file permission errors.
    """
    t = 1 
    if not data_to_be_saved:
        print(f"No data to save for {crm_owner['Name']}")
        return

    df = pd.DataFrame(data_to_be_saved)
    file_path = f"matches_of_{datetime.now().strftime('%b_%Y').lower()}_{crm_owner['Name']}.xlsx"
    if os.path.exists(file_path):
        file_path = f"matches_of_{datetime.now().strftime('%b_%Y').lower()}_{crm_owner['Name']}({t}).xlsx"
        while os.path.exists(f"matches_of_{datetime.now().strftime('%b_%Y').lower()}_{crm_owner['Name']}({t}).xlsx"):
            file_path = f"matches_of_{datetime.now().strftime('%b_%Y').lower()}_{crm_owner['Name']}({t}).xlsx"
            t = t+1

    retries = 0
    max_retries = os.getenv("Excel_MAX_RETRIES")  # Maximum attempts to access the file

    while is_file_open(file_path) and retries < max_retries:
        print(f"File '{file_path}' is in use. Retrying in 2 seconds...")
        time.sleep(2)  # Wait for 2 seconds before retrying
        retries += 1

    if retries >= max_retries:
        print(f"File '{file_path}' is still locked after {max_retries} attempts. Please close it.")
        return

    try:
        # Determine the mode and the usage of the if_sheet_exists parameter
        mode = 'a' if os.path.exists(file_path) else 'w'
        
        # If the file exists and we're appending, use if_sheet_exists='overlay'
        if mode == 'a':
            with pd.ExcelWriter(file_path, engine='openpyxl', mode=mode, if_sheet_exists='overlay') as writer:
                df.to_excel(writer, index=False, header=True, sheet_name="Sheet1")
        else:
            # For new files, don't use if_sheet_exists
            with pd.ExcelWriter(file_path, engine='openpyxl', mode=mode) as writer:
                df.to_excel(writer, index=False, header=True, sheet_name="Sheet1")

        send_email_with_attachment(crm_owner, file_path)

        print(f"Data saved successfully for {crm_owner['Name']} in {file_path}")

    except Exception as e:
        print(f"Error saving {crm_owner['Name']}'s data to Excel: {e}")
        
def authenticate_datatree():
    """
    Authenticate with the DataTree API using ClientId and ClientSecretKey.
    """
    url = DATATREE_BASE_URL + AUTH_ENDPOINT
    payload = {
        "ClientId": CLIENT_ID,
        "ClientSecretKey": CLIENT_SECRET
    }
    headers = {"Content-Type": "application/json"}
    print(" authenticating with DataTree")
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        print("Authentication successful.")
        return response.text.strip().strip('"')
    except requests.exceptions.RequestException as e:
        print(f"Error authenticating with DataTree: {e}")
        return None

auth_token = authenticate_datatree()

def fetch_all_contacts(KVCORE_TOKEN):
    url = "https://api.kvcore.com/v2/public/contacts"
    headers = {
        "accept": "application/json",
        "Content-Type": "application/json",
        "authorization": f"Bearer {KVCORE_TOKEN}"
    }
    try:
        scraper = cloudscraper.create_scraper()
        response = scraper.get(url, headers=headers)
        response.raise_for_status()
        return response.json().get("data", [])
    except Exception as e:
        print(f"Error fetching contacts: {e}")
        return []

def fetch_property_details(property_id):
    """
    Fetch property details by PropertyId and return specific details.
    """
    global auth_token
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
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        if data.get("Reports"):
            property_report = data["Reports"][0]
            report_data = property_report.get("Data", {})
            subject_property = report_data.get("SubjectProperty", {})
            owner_info = report_data.get("OwnerInformation", {})

            property_id = subject_property.get("PropertyId", "N/A")
            street_address = subject_property.get("SitusAddress", {}).get("StreetAddress", "N/A")
            County = subject_property.get("SitusAddress", {}).get("County", "N/A")
            State = subject_property.get("SitusAddress", {}).get("State", "N/A")
            owner_names = owner_info.get("OwnerNames", "N/A")
            seller_name = report_data.get("OwnerTransferInformation", {}).get("SellerName", "N/A")
            print(f"PropertyId {property_id} : {owner_names} : {street_address} : {seller_name} : ")
            if property_id == "N/A" :
                return None
            else :
                return {
                    "PropertyId": property_id,
                    "OwnerNames": owner_names,
                    "StreetAddress": street_address,
                    "County": County,
                    "State": State,
                    "SellerName": seller_name
                }
        else:
            print(f"PropertyId {property_id}: No report found.")
            return None
    except Exception as e:
        print(f"Error fetching property details for PropertyId {property_id}: {e}")
        return None

def generate_name_variations(first_name, middle_name, last_name):
    """
    Generate various name combinations and partials for flexible search.
    """
    # Ensure inputs are strings and alphabetic
    first_name = str(first_name).strip() if first_name else ""
    middle_name = str(middle_name).strip() if middle_name else ""
    last_name = str(last_name).strip() if last_name else ""

    # Validate names
    if not (first_name.isalpha() and last_name.isalpha() and (middle_name.isalpha() or not middle_name)):
        print(f"Invalid name: {last_name} {middle_name} {first_name}")
        return []

    # Exclude specific keywords
    if first_name.lower() in ["","."," ","user", "new","street" , "avenue"] or last_name.lower() in ["","."," ","user", "new","street" , "avenue"]:
        print(f"Invalid name: {last_name} {middle_name} {first_name}")
        return []

    variations = []
    if middle_name :
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
    else :
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
    print(f"all case use for searching : {variations}")
    
    return variations

def fetch_report_from_datatree(state_fips, county_fips, crm_owner, contact_details):
    """
    Fetch property reports from DataTree API using multiple name variations.
    """
    global auth_token
    data_collection = []
    all_results = []
    url = DATATREE_BASE_URL + FETCH_REPORT_ENDPOINT
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    six_months_ago = datetime.now() - timedelta(days=6*30.5)  # Approximate 6 months as 180 days
    formatted_date = six_months_ago.strftime('%Y-%m-%d')  # Format date as 'YYYY-MM-DD'

    name_variations = generate_name_variations(contact_details['first_name'], contact_details['middle_name'], contact_details['last_name'])
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
            "ProductNames": [
            "PropertyDetailReport"
          ],
          "SearchType": "Filter",
          "SearchRequest": {
            "ReferenceId": "1",
            "ProductName": "SearchLite",
            "MaxReturn": "100",
            "Filters": filters}
        }
        print(f"Fetching with payload: {payload}")
        try:
            response = requests.post(url, json=payload, headers=headers)
            if response.status_code == 400:
                error_response = response.json()
                if error_response.get("Message") == "No matching property found.":
                    print(f"No properties found for SellerName filter '{name_filter}'.")
                    continue  # Skip to next name_filter
                else:
                    print(f"400 Error for SellerName '{name_filter}': {error_response}")
                    continue
            response.raise_for_status()
            data = response.json()
            print(f"API Response: {data}")
            
            if "LitePropertyList" in data and data["LitePropertyList"]:
                all_results.extend(data["LitePropertyList"])
            else:
                print(f"No properties found for filter: {name_filter} as Seller")
                
        except Exception as e:
            print(f"Error fetching report for name filter '{name_filter}': {e}")

        filters = [
            {"FilterName": "OwnerNames", "FilterOperator": "contains", "FilterValues": [name_filter]},
            {"FilterName": "SaleDate", "FilterOperator": "is after", "FilterValues": [formatted_date]}
        ]
        
        if state_fips:
            filters.append({"FilterName": "StateFips", "FilterOperator": "is", "FilterValues": [state_fips]})
        if county_fips:
            filters.append({"FilterName": "CountyFips", "FilterOperator": "is", "FilterValues": [county_fips]})
        
        print(f"Fetching with payload: {payload}")
        try:
            response = requests.post(url, json=payload, headers=headers)
            if response.status_code == 400:
                error_response = response.json()
                if error_response.get("Message") == "No matching property found.":
                    print(f"No properties found for OwnerNames filter '{name_filter}'.")
                    continue
                else:
                    print(f"400 Error for OwnerNames '{name_filter}': {error_response}")
                    continue
            response.raise_for_status()
            data = response.json()
            print(f"API Response: {data}")
            
            if "LitePropertyList" in data and data["LitePropertyList"]:
                all_results.extend(data["LitePropertyList"])
            else:
                print(f"No properties found for filter: {name_filter} as Owner")
                
        except Exception as e:
            print(f"Error fetching report for name filter '{name_filter}': {e}")

        # Remove duplicates by PropertyId using a set
        unique_results = []
        for property_data in all_results:
            property_id = property_data.get("PropertyId")
            if property_id and property_id not in crm_owner['seen_property_ids']:
                crm_owner['seen_property_ids'].add(property_id)
                unique_results.append(property_data)

        print(f"Unique results after filtering for {contact_details['first_name']} {contact_details['last_name']}: {unique_results}")
        
        # Collecting the property details
        for property_data in unique_results:
            property_id = property_data.get("PropertyId")
            if property_id:
                property_details = fetch_property_details(property_id)
                if property_details:
                    data_row = {
                        "First Name": contact_details['first_name'],
                        "Middle Name": contact_details['middle_name'],
                        "Last Name": contact_details['last_name'],
                        "Email": contact_details['email'],
                        "Name Variation": name_filter,
                        "State": property_details["State"],
                        "County": property_details["County"],
                        "Property ID": property_details["PropertyId"],
                        "Owner Name": property_details["OwnerNames"],
                        "Street Address": property_details["StreetAddress"],
                        "Seller Name": property_details["SellerName"]
                    }
                    data_collection.append(data_row)
                    
                    # Save to seen_properties table
                    save_property_to_seen_properties(crm_owner['id'], data_row, contact_details)
    
    print(f"Fetched results for {contact_details['first_name']} {contact_details['last_name']} : {all_results}")
    print(f"Collected data for {contact_details['first_name']} {contact_details['last_name']} in {state_fips}/{county_fips} under {crm_owner['Name']} : {data_collection}")
    
    return data_collection

def search_datatree_thread():
    """
    Start the search process for each CRM owner using a ThreadPoolExecutor.
    Limits the number of concurrent threads to a maximum of 5.
    """
    MAX_THREADS = 5
    result_queue = queue.Queue()  # Thread-safe queue to collect results

    def process_crm_owner_wrapper(CRM_owner):
        """Wrapper function to process CRM owners and store results."""
        process_crm_owner(CRM_owner, result_queue)  # Your existing function

    # Use ThreadPoolExecutor to manage threads
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        future_to_owner = {executor.submit(process_crm_owner_wrapper, CRM_owner): CRM_owner for CRM_owner in CRM_owners}

        for future in concurrent.futures.as_completed(future_to_owner):
            CRM_owner = future_to_owner[future]
            try:
                future.result()  # Raise exceptions if any occur in threads
            except Exception as e:
                print(f"(X) Error processing {CRM_owner['Name']}: {e}")

    # Collect results after all threads complete
    while not result_queue.empty():
        CRM_owner_name, owner_results = result_queue.get()
        
def process_crm_owner(CRM_owner, result_queue):
    """
    Fetch contacts and start searches, tracking seen properties per CRM owner.
    """
    contacts = fetch_all_contacts(CRM_owner['token'])
    MAX_THREADS=10
    contact_threads = []
    contact_result_queue = queue.Queue()
    states_counties = CRM_owner.get("states_counties", [])
    
    def search_for_contact_wrapper(contact, contact_result_queue, CRM_owner, states_counties):
        """Wrapper function to process Contact and store results."""
        search_for_contact(contact, contact_result_queue, CRM_owner, states_counties)

    # Use ThreadPoolExecutor to manage threads
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
        future_to_contact = {executor.submit(search_for_contact_wrapper, contact, contact_result_queue, CRM_owner, states_counties): contact for contact in contacts}

        for future in concurrent.futures.as_completed(future_to_contact):
            contact = future_to_contact[future]
            try:
                future.result()  # Raise exceptions if any occur in threads
            except Exception as e:
                print(f"(X) Error processing contact for {CRM_owner['Name']}: {e}")

    # Collect and save updated property IDs for this CRM owner
    owner_results = []
    while not contact_result_queue.empty():
        owner_results.extend(contact_result_queue.get())

    print(f"Collected owner_results for {CRM_owner['Name']}: {owner_results}")

    # Save only this owner's updated `seen_property_ids`
    save_seen_property_ids(CRM_owner)

    if owner_results:
        result_queue.put((CRM_owner['Name'], owner_results))
        save_to_excel(owner_results, CRM_owner)

def search_for_contact(contact, contact_result_queue, crm_owner, states_counties):
    """
    Process a single contact while tracking seen properties and filtering by states_counties.
    Runs `perform_search_for_contact()` as a separate thread for each state/county.
    If `states_counties` is missing or empty, search without filtering.
    """
    contact_details = {
        'first_name': contact.get('name', '').split()[0] if ' ' in contact.get('name', '') else "",
        'middle_name': contact.get('name', '').split()[1] if len(contact.get('name', '').split()) == 3 else "",
        'last_name': contact.get('name', '').split()[-1] if len(contact.get('name', '').split()) > 1 else contact.get('name'),
        'email': contact.get('email', '')
    }

    # If no states_counties, search without filters
    if not states_counties:
        print(f"No state/county filter for {contact_details['first_name']} {contact_details['last_name']}. Searching all states/counties.")
        state_result_queue = queue.Queue()
        perform_search_for_contact(contact_details, None, None, crm_owner, state_result_queue)

        contact_properties = []
        while not state_result_queue.empty():
            contact_properties.extend(state_result_queue.get())

    else:
        # Launch threads for each state/county
        threads = []
        state_result_queues = []

        for state_county in states_counties:
            # Handle both old format (state_FIPS/county_FIPS) and new format (state_fips/county_fips)
            state_fips = state_county.get("state_FIPS") or state_county.get("state_fips")
            county_fips = state_county.get("county_FIPS") or state_county.get("county_fips")

            state_result_queue = queue.Queue()
            state_result_queues.append(state_result_queue)

            thread = threading.Thread(target=perform_search_for_contact, args=(contact_details, state_fips, county_fips, crm_owner, state_result_queue))
            threads.append(thread)
            thread.start()

        # Wait for all threads to finish
        for thread in threads:
            thread.join()

        # Collect results
        contact_properties = []
        for result_queue in state_result_queues:
            while not result_queue.empty():
                contact_properties.extend(result_queue.get())

    # Remove already seen properties
    new_properties = [prop for prop in contact_properties if prop["Property ID"]]

    # Update seen properties
    for prop in new_properties:
        crm_owner['seen_property_ids'].add(prop["Property ID"])

    if new_properties:
        contact_result_queue.put(new_properties)

def perform_search_for_contact(contact_details, state_fips, county_fips, crm_owner, result_queue):
    """
    Fetch search results for a specific contact in a given state and county.
    Results are added to `result_queue` to allow multi-threaded execution.
    Now passing the entire CRM_owner to access `seen_property_ids`.
    """
    print(f"Searching for {contact_details['first_name']} {contact_details['last_name']} in State FIPS: {state_fips}, County FIPS: {county_fips}")

    results = fetch_report_from_datatree(state_fips, county_fips, crm_owner, contact_details)  # Fetch data

    if results:
        result_queue.put(results)  # Store results in the queue

# --- Update LAST_RUN_MONTH in .env (or print new value if using Railway) ---
def update_last_run_month():
    current_month = datetime.today().month
    os.environ["LAST_RUN_MONTH"] = str(current_month)

    # If you are using a local .env file (dev only), update it
    dotenv_path = ".env"
    if os.path.exists(dotenv_path):
        with open(dotenv_path, "r") as file:
            lines = file.readlines()

        with open(dotenv_path, "w") as file:
            found = False
            for line in lines:
                if line.startswith("LAST_RUN_MONTH="):
                    file.write(f"LAST_RUN_MONTH={current_month}\n")
                    found = True
                else:
                    file.write(line)
            if not found:
                file.write(f"LAST_RUN_MONTH={current_month}\n")

    print(f"(✓) Updated LAST_RUN_MONTH to {current_month}")

if __name__ == "__main__":
    search_datatree_thread()
    update_last_run_month()
