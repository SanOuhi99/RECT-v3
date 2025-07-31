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

# Exit if today is not a weekday (Monday=0, Sunday=6)
if datetime.today().weekday() > 4:
    print("Today is weekend. Exiting.")
    exit(0)

# Load environment variables
load_dotenv()

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
        "authorization": f
