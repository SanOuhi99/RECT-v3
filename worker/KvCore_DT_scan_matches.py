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
import difflib
from fuzzywuzzy import fuzz

# Load environment variables
load_dotenv()


def should_run_this_month():
    today = datetime.today()
    current_month = today.month

    # Check if it's a weekday (Mon-Fri)
    last_weekday = int(os.getenv("LAST_WEEKDAY",4))
    if today.weekday() > last_weekday:  # 5 and 6 are Saturday and Sunday
        print(f"Today is weekend ({today.weekday()}), not running.")
        return False

    # Read from last_run_month.txt file
    try:
        print(f"cheking {file_path}")
        with open(file_path, "r") as f:
            last_run_month = int(f.read().strip())
    except FileNotFoundError:
        # If file doesn't exist, create it with current month
        with open(file_path, "w") as f:
            f.write(str(current_month))
        return True  # First run
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return False

    if current_month == last_run_month:
        print(f"Already ran this month (last run: {last_run_month}).")
        return False

    return True

def update_last_run_month():
    current_month = datetime.today().month
    try:
        with open(file_path, "w") as f:
            f.write(str(current_month))
        print(f"(✓) Updated last_run_month.txt to {current_month}")
    except Exception as e:
        print(f"(X) Failed to update last_run_month.txt: {e}")

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
    contract_date = Column(DateTime)
    match_percentage = Column(Integer)  # New column for match percentage
    match_field = Column(String)       # New column for match field (Owner/Seller)
    created_at = Column(DateTime, server_default=func.now())

# Create database session
def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # Don't close here, close manually when done

DATA_DIR = "/worker"
file_path = os.path.join(DATA_DIR, "last_run_month.txt")
DATATREE_BASE_URL = "https://dtapiuat.datatree.com"
AUTH_ENDPOINT = "/api/Login/AuthenticateClient"
FETCH_REPORT_ENDPOINT = "/api/Report/GetReport"
FETCH_PropertySearch_ENDPOINT = "/api/Search/PropertySearch"

# Ensure the directory exists
os.makedirs(DATA_DIR, exist_ok=True)

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
        # Parse the contract date if it exists
        contract_date = None
        if property_data.get("Contract Date"):
            try:
                contract_date_str = property_data.get("Contract Date")
                if contract_date_str:
                    if 'T' in contract_date_str:
                        contract_date = datetime.fromisoformat(contract_date_str.replace('T', ' ').replace('Z', ''))
                    else:
                        contract_date = datetime.strptime(contract_date_str, '%Y-%m-%d')
            except (ValueError, AttributeError) as e:
                print(f"Error parsing contract date '{property_data.get('Contract Date')}': {e}")
                contract_date = None
        
        # Extract match percentage (remove % sign if present)
        match_percentage = property_data.get("Match Percentage", "0%").replace('%', '')
        
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
            name_variation=property_data.get("Name Variation"),
            contract_date=contract_date,
            match_percentage=int(match_percentage),  # Save as integer
            match_field=property_data.get("Match Field", "Unknown"),  # Save match field
            created_at=datetime.now()
        )
        
        db.add(seen_property)
        db.commit()
        print(f"Saved property {property_data.get('Property ID')} with match details to seen_properties table")
        
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

    # Attach the Excel file (not CSV)
    file_name = os.path.basename(file_path)
    try:
        # Check if file exists before trying to attach
        if not os.path.exists(file_path):
            print(f"(X) File not found: {file_path}")
            return False
            
        with open(file_path, "rb") as f:
            # Use correct MIME type for Excel files
            if file_path.endswith('.xlsx'):
                msg.add_attachment(f.read(), maintype="application", subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=file_name)
            else:
                msg.add_attachment(f.read(), maintype="application", subtype="octet-stream", filename=file_name)

        # Attach the logo
        if os.path.exists(LOGO_PATH):
            with open(LOGO_PATH, "rb") as f:
                msg.add_attachment(f.read(), maintype="image", subtype="jpeg", filename="logo.jpg", cid="logo_cid")
        else:
            print(f"(!) Logo file not found: {LOGO_PATH}")

        # Send the email
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

        print(f"(✓) Email with attachment sent successfully to {crm_owner['email']}!")
        return True
    
    except FileNotFoundError as e:
        print(f"(X) File not found: {e}")
        return False
    except smtplib.SMTPAuthenticationError:
        print("(X) SMTP Authentication Error: Check your email credentials.")
        return False
    except smtplib.SMTPException as e:
        print(f"(X) SMTP Error: {e}")
        return False
    except Exception as e:
        print(f"(X) Unexpected error sending email: {e}")
        return False

def save_to_excel(data_to_be_saved, crm_owner):
    """
    Save the collected data to an Excel file, handling file permission errors.
    Creates a folder with current month name and saves files there.
    """
    t = 1 
    if not data_to_be_saved:
        print(f"No data to save for {crm_owner['Name']}")
        return False

    try:
        df = pd.DataFrame(data_to_be_saved)
        print(f"Created DataFrame with {len(df)} rows for {crm_owner['Name']}")
        
        # Create folder with current month name
        current_month_folder = datetime.now().strftime('%B_%Y')  # e.g., "August_2025"
        
        # Create full path to the folder
        full_folder_path = os.path.join(DATA_DIR, current_month_folder)
        os.makedirs(full_folder_path, exist_ok=True)  # Create folder if it doesn't exist
        print(f"Created/Using folder: {full_folder_path}")
        
        # Create file path within the month folder
        file_name = f"matches_of_{datetime.now().strftime('%b_%Y').lower()}_{crm_owner['Name']}.xlsx"
        file_path = os.path.join(full_folder_path, file_name)
        
        # Handle file naming conflicts
        if os.path.exists(file_path):
            while os.path.exists(os.path.join(full_folder_path, f"matches_of_{datetime.now().strftime('%b_%Y').lower()}_{crm_owner['Name']}({t}).xlsx")):
                t = t + 1
            file_name = f"matches_of_{datetime.now().strftime('%b_%Y').lower()}_{crm_owner['Name']}({t}).xlsx"
            file_path = os.path.join(full_folder_path, file_name)

        print(f"Final file path: {file_path}")
        
        retries = 0
        # Convert environment variable to integer with a default value
        max_retries = int(os.getenv("Excel_MAX_RETRIES", "5"))  # Default to 5 if not set

        while is_file_open(file_path) and retries < max_retries:
            print(f"File '{file_path}' is in use. Retrying in 2 seconds...")
            time.sleep(2)  # Wait for 2 seconds before retrying
            retries += 1

        if retries >= max_retries:
            print(f"File '{file_path}' is still locked after {max_retries} attempts. Please close it.")
            return False

        # Save the Excel file
        try:
            # Always create a new file to avoid complications
            with pd.ExcelWriter(file_path, engine='openpyxl', mode='w') as writer:
                df.to_excel(writer, index=False, header=True, sheet_name="Sheet1")
            
            print(f"Excel file created successfully: {file_path}")
            
            # Verify the file was created and has content
            if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                print(f"File verified - Size: {os.path.getsize(file_path)} bytes")
                
                # Send email with attachment
                email_sent = send_email_with_attachment(crm_owner, file_path)
                if email_sent:
                    print(f"Data saved and emailed successfully for {crm_owner['Name']} in {file_path}")
                    return True
                else:
                    print(f"File saved but email failed for {crm_owner['Name']}")
                    return False
            else:
                print(f"File was not created or is empty: {file_path}")
                return False

        except Exception as e:
            print(f"Error creating Excel file for {crm_owner['Name']}: {e}")
            return False
            
    except Exception as e:
        print(f"Error in save_to_excel for {crm_owner['Name']}: {e}")
        return False
        
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
            owner_transfer_info = report_data.get("OwnerTransferInformation", {})

            property_id = subject_property.get("PropertyId", "N/A")
            street_address = subject_property.get("SitusAddress", {}).get("StreetAddress", "N/A")
            County = subject_property.get("SitusAddress", {}).get("County", "N/A")
            State = subject_property.get("SitusAddress", {}).get("State", "N/A")
            owner_names = owner_info.get("OwnerNames", "N/A")
            seller_name = owner_transfer_info.get("SellerName", "N/A")
            sale_date = owner_transfer_info.get("SaleDate", None)  # Extract sale date
            
            print(f"PropertyId {property_id} : {owner_names} : {street_address} : {seller_name} : {sale_date}")
            
            if property_id == "N/A":
                return None
            else:
                return {
                    "PropertyId": property_id,
                    "OwnerNames": owner_names,
                    "StreetAddress": street_address,
                    "County": County,
                    "State": State,
                    "SellerName": seller_name,
                    "SaleDate": sale_date  # Include sale date in return
                }
        else:
            print(f"PropertyId {property_id}: No report found.")
            return None
    except Exception as e:
        print(f"Error fetching property details for PropertyId {property_id}: {e}")
        return None

def generate_name_variations(first_name, middle_name, last_name):
    """
    Generate conservative name combinations for flexible search.
    More restrictive to avoid false positives.
    """
    # Ensure inputs are strings and alphabetic
    first_name = str(first_name).strip() if first_name else ""
    middle_name = str(middle_name).strip() if middle_name else ""
    last_name = str(last_name).strip() if last_name else ""

    # Validate names - be more strict
    if not (first_name.isalpha() and last_name.isalpha() and (middle_name.isalpha() or not middle_name)):
        print(f"Invalid name: {last_name} {middle_name} {first_name}")
        return []

    # Exclude specific keywords and require minimum lengths
    if (first_name.lower() in ["", ".", " ", "user", "new", "street", "avenue"] or 
        last_name.lower() in ["", ".", " ", "user", "new", "street", "avenue"] or
        len(first_name) < 2 or len(last_name) < 2):
        print(f"Invalid or too short name: {last_name} {middle_name} {first_name}")
        return []

    variations = []
    
    # Only create conservative variations
    if middle_name:
        # Full name variations
        variations.append(f"{first_name} {middle_name} {last_name}")
        variations.append(f"{last_name} {first_name} {middle_name}")
        variations.append(f"{last_name} {middle_name} {first_name}")
        
        # First and last name only (most common)
        variations.append(f"{first_name} {last_name}")
        variations.append(f"{last_name} {first_name}")
        
        # Only add middle initial if middle name is long enough
        if len(middle_name) > 1:
            variations.append(f"{first_name} {middle_name[0]} {last_name}")
            variations.append(f"{last_name} {first_name} {middle_name[0]}")
    else:
        # Just first and last name variations
        variations.append(f"{first_name} {last_name}")
        variations.append(f"{last_name} {first_name}")
    
    print(f"Conservative name variations for searching: {variations}")
    return variations

def normalize_name_for_matching(name):
    """
    Normalize a name for matching by removing common prefixes, suffixes, and formatting.
    """
    if not name:
        return ""
    
    # Convert to uppercase and remove extra spaces
    name = str(name).upper().strip()
    
    # Remove common prefixes and suffixes
    prefixes_to_remove = [
        "MR ", "MRS ", "MS ", "DR ", "PROF ", "REV ", "FATHER ", "SISTER ",
        "JUDGE ", "HON ", "HONORABLE ", "SIR ", "LADY ", "LORD ", "CAPTAIN ", "MAJOR "
    ]
    
    suffixes_to_remove = [
        " JR", " SR", " III", " IV", " V", " II", " 2ND", " 3RD", " 4TH",
        " PHD", " MD", " ESQ", " DDS", " DVM", " RN", " CPA"
    ]
    
    # Remove prefixes
    for prefix in prefixes_to_remove:
        if name.startswith(prefix):
            name = name[len(prefix):].strip()
            break
    
    # Remove suffixes
    for suffix in suffixes_to_remove:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
            break
    
    # Remove common business entity suffixes
    business_suffixes = [
        " LLC", " INC", " CORP", " CORPORATION", " LTD", " LIMITED",
        " LP", " LLP", " PLLC", " CO", " COMPANY", " ENTERPRISES",
        " MANAGEMENT", " SERVICES", " TRUST", " ESTATE", " PROPERTIES",
        " INVESTMENTS", " GROUP", " HOLDINGS", " VENTURES"
    ]
    
    for suffix in business_suffixes:
        if name.endswith(suffix):
            # If it's a business entity, return empty to indicate no personal match
            return ""
    
    # Remove special characters and extra spaces
    name = re.sub(r'[^\w\s]', ' ', name)
    name = ' '.join(name.split())
    
    return name

def calculate_name_match_percentage(contact_details, property_name, name_type="owner"):
    """
    Calculate matching percentage between contact name and property owner/seller name.
    Returns a dictionary with match percentage and details.
    """
    if not property_name:
        return {"percentage": 0, "match_type": "no_name", "details": "No property name provided"}
    
    # Normalize the property name
    normalized_property_name = normalize_name_for_matching(property_name)
    
    # If it's a business entity (returns empty after normalization), skip
    if not normalized_property_name:
        return {"percentage": 0, "match_type": "business_entity", "details": f"Property name appears to be business entity: {property_name}"}
    
    # Extract contact name parts
    first_name = contact_details.get('first_name', '').upper().strip()
    middle_name = contact_details.get('middle_name', '').upper().strip()
    last_name = contact_details.get('last_name', '').upper().strip()
    
    if not first_name or not last_name:
        return {"percentage": 0, "match_type": "invalid_contact", "details": "Contact name incomplete"}
    
    # Create different name combinations to test
    contact_variations = []
    
    # Full name combinations
    if middle_name:
        contact_variations.extend([
            f"{first_name} {middle_name} {last_name}",
            f"{first_name} {last_name} {middle_name}",
            f"{last_name} {first_name} {middle_name}",
            f"{last_name} {middle_name} {first_name}",
            f"{first_name} {middle_name[0]} {last_name}",  # Middle initial
        ])
    
    # First and last name combinations
    contact_variations.extend([
        f"{first_name} {last_name}",
        f"{last_name} {first_name}",
        f"{last_name}, {first_name}",  # Comma separated
    ])
    
    # Individual name components
    individual_components = [first_name, last_name]
    if middle_name:
        individual_components.append(middle_name)
    
    best_match = {"percentage": 0, "match_type": "no_match", "matched_variation": "", "details": ""}
    
    # 1. Check for exact matches (100%)
    for variation in contact_variations:
        if variation == normalized_property_name:
            return {
                "percentage": 100,
                "match_type": "exact_match",
                "matched_variation": variation,
                "details": f"Exact match found: '{variation}' = '{normalized_property_name}'"
            }
    
    # 2. Check for substring matches (high percentage)
    for variation in contact_variations:
        if variation in normalized_property_name:
            # Calculate how much of the property name is covered by the contact name
            coverage = len(variation) / len(normalized_property_name)
            percentage = min(95, int(coverage * 100))  # Cap at 95% for substring matches
            
            if percentage > best_match["percentage"]:
                best_match = {
                    "percentage": percentage,
                    "match_type": "substring_match",
                    "matched_variation": variation,
                    "details": f"Substring match: '{variation}' found in '{normalized_property_name}'"
                }
    
    # 3. Use fuzzy matching for partial matches
    for variation in contact_variations:
        # Different fuzzy matching algorithms
        ratio = fuzz.ratio(variation, normalized_property_name)
        token_sort_ratio = fuzz.token_sort_ratio(variation, normalized_property_name)
        token_set_ratio = fuzz.token_set_ratio(variation, normalized_property_name)
        
        # Take the highest score
        fuzzy_score = max(ratio, token_sort_ratio, token_set_ratio)
        
        if fuzzy_score > best_match["percentage"]:
            best_match = {
                "percentage": fuzzy_score,
                "match_type": "fuzzy_match",
                "matched_variation": variation,
                "details": f"Fuzzy match: '{variation}' vs '{normalized_property_name}' (ratio:{ratio}, token_sort:{token_sort_ratio}, token_set:{token_set_ratio})"
            }
    
    # 4. Check individual name components (lower scores)
    component_matches = []
    for component in individual_components:
        if len(component) > 2 and component in normalized_property_name:
            component_matches.append(component)
    
    if component_matches and best_match["percentage"] < 60:
        # Calculate percentage based on how many components match
        component_percentage = int((len(component_matches) / len(individual_components)) * 60)
        if component_percentage > best_match["percentage"]:
            best_match = {
                "percentage": component_percentage,
                "match_type": "component_match",
                "matched_variation": " + ".join(component_matches),
                "details": f"Component matches: {component_matches} found in '{normalized_property_name}'"
            }
    
    return best_match

def get_overall_match_score(contact_details, property_details):
    """
    Get overall match score for a property by checking both owner and seller names.
    Returns the best match between the two.
    """
    owner_names = property_details.get("OwnerNames", "")
    seller_name = property_details.get("SellerName", "")
    
    # Calculate match for owner names
    owner_match = calculate_name_match_percentage(contact_details, owner_names, "owner")
    
    # Calculate match for seller name
    seller_match = calculate_name_match_percentage(contact_details, seller_name, "seller")
    
    # Return the best match
    if owner_match["percentage"] >= seller_match["percentage"]:
        owner_match["field_matched"] = "Owner"
        return owner_match
    else:
        seller_match["field_matched"] = "Seller"
        return seller_match

def should_include_match(match_result, minimum_threshold=50):
    """
    Determine if a match should be included based on percentage and type.
    """
    percentage = match_result["percentage"]
    match_type = match_result["match_type"]
    
    # Different thresholds for different match types
    if match_type in ["exact_match", "substring_match"]:
        return percentage >= 80
    elif match_type == "fuzzy_match":
        return percentage >= 70
    elif match_type == "component_match":
        return percentage >= minimum_threshold
    else:
        return False

def fetch_report_from_datatree(state_fips, county_fips, crm_owner, contact_details):
    """
    Fetch property reports from DataTree API and calculate match percentages.
    MODIFIED: Added percentage matching system.
    """
    global auth_token
    data_collection = []
    all_results = []
    url = DATATREE_BASE_URL + FETCH_REPORT_ENDPOINT
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    six_months_ago = datetime.now() - timedelta(days=6*30.5)
    formatted_date = six_months_ago.strftime('%Y-%m-%d')

    name_variations = generate_name_variations(
        contact_details['first_name'], 
        contact_details['middle_name'], 
        contact_details['last_name']
    )
    
    # If no valid variations, skip this contact
    if not name_variations:
        print(f"No valid name variations for {contact_details['first_name']} {contact_details['last_name']}")
        return []
    
    for name_filter in name_variations:
        print(f"Searching with name variation: '{name_filter}'")
        
        # Search as Seller
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
            response = requests.post(url, json=payload, headers=headers)
            if response.status_code == 400:
                error_response = response.json()
                if error_response.get("Message") == "No matching property found.":
                    print(f"No properties found for SellerName filter '{name_filter}'.")
                    continue
                else:
                    print(f"400 Error for SellerName '{name_filter}': {error_response}")
                    continue
            
            response.raise_for_status()
            data = response.json()
            
            if "LitePropertyList" in data and data["LitePropertyList"]:
                all_results.extend(data["LitePropertyList"])
                
        except Exception as e:
            print(f"Error fetching report for seller name filter '{name_filter}': {e}")

        # Search as Owner
        filters = [
            {"FilterName": "OwnerNames", "FilterOperator": "contains", "FilterValues": [name_filter]},
            {"FilterName": "SaleDate", "FilterOperator": "is after", "FilterValues": [formatted_date]}
        ]
        
        if state_fips:
            filters.append({"FilterName": "StateFips", "FilterOperator": "is", "FilterValues": [state_fips]})
        if county_fips:
            filters.append({"FilterName": "CountyFips", "FilterOperator": "is", "FilterValues": [county_fips]})
        
        payload["SearchRequest"]["Filters"] = filters
        
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
            
            if "LitePropertyList" in data and data["LitePropertyList"]:
                all_results.extend(data["LitePropertyList"])
                
        except Exception as e:
            print(f"Error fetching report for owner name filter '{name_filter}': {e}")

    # Remove duplicates by PropertyId
    unique_results = []
    seen_property_ids = set()
    for property_data in all_results:
        property_id = property_data.get("PropertyId")
        if property_id and property_id not in seen_property_ids and property_id not in crm_owner['seen_property_ids']:
            seen_property_ids.add(property_id)
            unique_results.append(property_data)

    print(f"Found {len(unique_results)} unique properties before matching analysis")
    
    # Analyze each property match with percentage scoring
    validated_count = 0
    for property_data in unique_results:
        property_id = property_data.get("PropertyId")
        if property_id:
            property_details = fetch_property_details(property_id)
            if property_details:
                # Calculate match percentage
                match_result = get_overall_match_score(contact_details, property_details)
                
                # Log the match analysis
                print(f"Property {property_id} - Match Analysis:")
                print(f"  Contact: {contact_details['first_name']} {contact_details['last_name']}")
                print(f"  Owner: {property_details.get('OwnerNames', 'N/A')}")
                print(f"  Seller: {property_details.get('SellerName', 'N/A')}")
                print(f"  Match Score: {match_result['percentage']}% ({match_result['match_type']})")
                print(f"  Field Matched: {match_result.get('field_matched', 'Unknown')}")
                print(f"  Details: {match_result['details']}")
                
                # Decide whether to include this match
                if should_include_match(match_result, minimum_threshold=60):  # You can adjust this threshold
                    crm_owner['seen_property_ids'].add(property_id)
                    validated_count += 1
                    
                    # Determine match quality label
                    percentage = match_result["percentage"]
                    if percentage >= 95:
                        match_quality = "Excellent Match"
                    elif percentage >= 85:
                        match_quality = "Very Good Match"
                    elif percentage >= 75:
                        match_quality = "Good Match"
                    elif percentage >= 65:
                        match_quality = "Fair Match"
                    else:
                        match_quality = "Possible Match"
                    
                    data_row = {
                        "First Name": contact_details['first_name'],
                        "Middle Name": contact_details['middle_name'],
                        "Last Name": contact_details['last_name'],
                        "Email": contact_details['email'],
                        "Name Variation": match_result.get('matched_variation', 'Unknown'),
                        "State": property_details["State"],
                        "County": property_details["County"],
                        "Property ID": property_details["PropertyId"],
                        "Owner Name": property_details["OwnerNames"],
                        "Street Address": property_details["StreetAddress"],
                        "Seller Name": property_details["SellerName"],
                        "Contract Date": property_details["SaleDate"],
                        "Match Percentage": f"{percentage}%",
                        "Match Quality": match_quality,
                        "Match Field": match_result.get('field_matched', 'Unknown'),
                        "Match Type": match_result['match_type']
                    }
                    data_collection.append(data_row)
                    
                    # Save to seen_properties table
                    save_property_to_seen_properties(crm_owner['id'], data_row, contact_details)
                    
                    print(f"  ✓ INCLUDED - {match_quality}")
                else:
                    print(f"  ✗ EXCLUDED - Score too low ({match_result['percentage']}%)")
    
    print(f"Final Results: {validated_count} out of {len(unique_results)} properties included for {contact_details['first_name']} {contact_details['last_name']}")
    
    # Sort by match percentage (highest first)
    data_collection.sort(key=lambda x: int(x["Match Percentage"].replace('%', '')), reverse=True)
    
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
    print(f"Processing CRM owner: {CRM_owner['Name']}")
    
    contacts = fetch_all_contacts(CRM_owner['token'])
    print(f"Fetched {len(contacts)} contacts for {CRM_owner['Name']}")
    
    if not contacts:
        print(f"No contacts found for {CRM_owner['Name']}")
        return
    
    MAX_THREADS=10
    contact_threads = []
    contact_result_queue = queue.Queue()
    states_counties = CRM_owner.get("states_counties", [])
    
    print(f"States/Counties for {CRM_owner['Name']}: {states_counties}")
    
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
                print(f"(X) Error processing contact {contact.get('name', 'Unknown')} for {CRM_owner['Name']}: {e}")

    # Collect and save updated property IDs for this CRM owner
    owner_results = []
    while not contact_result_queue.empty():
        owner_results.extend(contact_result_queue.get())

    print(f"Collected {len(owner_results)} results for {CRM_owner['Name']}")
    print(f"Sample results: {owner_results[:2] if owner_results else 'None'}")

    # Save only this owner's updated `seen_property_ids`
    save_seen_property_ids(CRM_owner)

    if owner_results:
        result_queue.put((CRM_owner['Name'], owner_results))
        success = save_to_excel(owner_results, CRM_owner)
        if success:
            print(f"Successfully processed and saved data for {CRM_owner['Name']}")
        else:
            print(f"Failed to save data for {CRM_owner['Name']}")
    else:
        print(f"No results to save for {CRM_owner['Name']}")

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


if __name__ == "__main__":
    print("="*50)
    print(f"Script started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*50)
    
    try:
        # Check if we should run this month
        if not should_run_this_month():
            print("Exiting - not first weekday or already ran this month.")
            exit(0)
            
        print("Starting property search process...")
        
        # Execute the main search function
        search_datatree_thread()
        
        # Update last run month only if successful
        update_last_run_month()
        
        print("="*50)
        print("Script completed successfully!")
        print(f"Finished at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*50)
        
    except Exception as e:
        print("!"*50)
        print(f"CRITICAL ERROR: {str(e)}")
        print("!"*50)
        print("Stack Trace:")
        import traceback
        traceback.print_exc()
        exit(1)  # Exit with error code
