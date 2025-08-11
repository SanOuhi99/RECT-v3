import os
from typing import List, Optional,Dict, Any
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, Request, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy import create_engine, Column, Integer, String, JSON, text, insert, UniqueConstraint, DateTime, func, Boolean
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from dotenv import load_dotenv
from passlib.context import CryptContext
import jwt
import csv
from pathlib import Path

load_dotenv()  # Load env vars from .env if present

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

if not DATABASE_URL:
    raise Exception("DATABASE_URL environment variable not set")

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_admin_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire, "type": "admin"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- Database setup ---
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=0,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Models ---

def import_states_counties_from_csv(csv_path: str, db: Session):
    if not Path(csv_path).exists():
        print(f"CSV file not found: {csv_path}")
        return

    with open(csv_path, newline='') as csvfile:
        reader = csv.DictReader(csvfile, delimiter=';')
        rows = []
        for row in reader:
            rows.append({
                "statefips": int(row["StateFIPS"]),
                "state": row["State"],
                "countyfips": int(row["CountyFIPS"]),
                "county": row["County"]
            })

    if rows:
        db.execute(insert(StatesCounties), rows)
        db.commit()
        print(f"✅ Imported {len(rows)} records from {csv_path}")


class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, unique=True, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    password = Column(String, nullable=False)  # hashed password
    role = Column(String, nullable=False, default="admin")  # admin, super_admin
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    companycode = Column(String, nullable=False, unique=True, index=True)
    password = Column(String, nullable=False)  # hashed password

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
    companycode = Column(String, nullable=False)  # Should match Company.companycode
    password = Column(String, nullable=False)  # hashed password
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
    contract_date = Column(DateTime, nullable=True)  # Add this field
    created_at = Column(DateTime, server_default=func.now())

# Create tables (run once at startup)
Base.metadata.create_all(bind=engine)

# Import CSV once at startup (only if table is empty)
with SessionLocal() as session:
    existing_count = session.query(StatesCounties).count()
    if existing_count == 0:
        import_states_counties_from_csv("states_counties.csv", session)

with SessionLocal() as session:
    existing_admin = session.query(Admin).first()
    if not existing_admin:
        default_admin = Admin(
            username="Rectadmin",
            email="admin@rect.com",
            password=hash_password("!Ezpass4905"),  # Change this!
            role="super_admin"
        )
        session.add(default_admin)
        session.commit()
        print("✅ Default admin created: Rectadmin/!Ezpass4905")

# Authentication dependency
def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = verify_token(token)
    admin_id = payload.get("admin_id")
    if not admin_id:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    
    admin = db.query(Admin).filter(Admin.id == admin_id, Admin.is_active == True).first()
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found or inactive")
    
    return admin
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = verify_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(CrmOwner).filter(CrmOwner.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user
# Authentication dependency for companies
def get_current_company(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = verify_token(token)
    company_id = payload.get("company_id")
    if not company_id:
        raise HTTPException(status_code=401, detail="Invalid company token")
    
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=401, detail="Company not found")
    
    return company

def create_company_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire, "type": "company"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt
# --- Schemas ---

# Add admin schemas
class AdminLogin(BaseModel):
    username: str
    password: str

class AdminOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        orm_mode = True

class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str
    admin: AdminOut

class UserStats(BaseModel):
    total_users: int
    active_users: int
    total_companies: int
    total_properties: int
    recent_signups: int
    users_by_state: List[dict]
    properties_by_month: List[dict]

# StateCounties schemas
class County(BaseModel):
    county_FIPS: int
    county_name: str

class StateCounties(BaseModel):
    state_FIPS: int
    state_name: str
    counties: List[County]

# Company schemas
class CompanyBase(BaseModel):
    name: str
    companycode: str
    password: str

    @validator('password')
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

class CompanyCreate(CompanyBase):
    pass

# Company Login schemas
class CompanyLogin(BaseModel):
    companycode: str
    password: str

class CompanyOut(BaseModel):
    id: int
    name: str
    companycode: str
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class CompanyLoginResponse(BaseModel):
    access_token: str
    token_type: str
    company: CompanyOut

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

    @validator('new_password')
    def password_min_length(cls, v):
        if v and len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

# Agent management schemas for companies
class AgentCreateByCompany(BaseModel):
    name: str
    email: EmailStr
    token: str
    password: str
    states_counties: Optional[List[StateCounties]] = []

    @validator('password')
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

class AgentOutForCompany(BaseModel):
    id: int
    name: str
    email: EmailStr
    token: str
    companycode: str
    states_counties: Optional[List[StateCounties]] = []
    property_count: Optional[int] = 0
    assigned_states: Optional[int] = 0
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    class Config:
        orm_mode = True

class CompanyStats(BaseModel):
    total_agents: int
    active_agents: int
    total_properties: int
    monthly_properties: int
    recent_signups: int

class CompanyAnalytics(BaseModel):
    top_agents: List[dict]
    properties_by_month: List[dict]
    state_breakdown: List[dict]
    performance_metrics: dict

# CRM Owner schemas
class OwnerBase(BaseModel):
    name: str
    email: EmailStr
    token: str
    companycode: str
    password: str
    states_counties: List[StateCounties]

    @validator('password')
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

class OwnerCreate(OwnerBase):
    pass

class OwnerOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    token: str
    companycode: str
    states_counties: List[StateCounties]

    class Config:
        orm_mode = True

class OwnerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    token: Optional[str] = None
    companycode: Optional[str] = None
    states_counties: Optional[List[StateCounties]] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

    @validator('new_password')
    def password_min_length(cls, v):
        if v and len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

# Login schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: OwnerOut

# Seen Properties schemas
class SeenPropertyOut(BaseModel):
    id: int
    crm_owner_id: int
    property_id: str
    owner_name: Optional[str] = None
    street_address: Optional[str] = None
    county: Optional[str] = None
    state: Optional[str] = None
    seller_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_first_name: Optional[str] = None
    contact_last_name: Optional[str] = None
    contact_middle_name: Optional[str] = None
    name_variation: Optional[str] = None
    contract_date: Optional[datetime] = None  # Add this field
    created_at: datetime

    @validator('property_id', pre=True)
    def convert_property_id_to_string(cls, v):
        if v is not None:
            return str(v)
        return v

    class Config:
        orm_mode = True

# --- FastAPI app ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://frontend-rectenvironment.up.railway.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication endpoints
@app.post("/login", response_model=LoginResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(CrmOwner).filter(CrmOwner.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"user_id": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/me", response_model=OwnerOut)
def get_current_user_info(current_user: CrmOwner = Depends(get_current_user)):
    return current_user

@app.put("/me", response_model=OwnerOut)
def update_current_user(
    user_update: OwnerUpdate,
    current_user: CrmOwner = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Handle password change if requested
    if user_update.current_password and user_update.new_password:
        # Verify current password
        if not verify_password(user_update.current_password, current_user.password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Update to new password
        current_user.password = hash_password(user_update.new_password)
    elif user_update.current_password or user_update.new_password:
        # If only one password field is provided, require both
        raise HTTPException(status_code=400, detail="Both current and new passwords are required for password change")

    # Update name if provided
    if user_update.name is not None:
        current_user.name = user_update.name
    
    # Update email if provided
    if user_update.email is not None:
        # Check if email is already taken by another user
        existing = db.query(CrmOwner).filter(
            CrmOwner.email == user_update.email,
            CrmOwner.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = user_update.email
    
    # Update company code if provided
    if user_update.companycode is not None:
        # Verify the company code exists
        company = db.query(Company).filter(Company.companycode == user_update.companycode).first()
        if not company:
            raise HTTPException(status_code=400, detail="Invalid company code")
        current_user.companycode = user_update.companycode
    
    # Update CRM token if provided
    if user_update.token is not None:
        current_user.token = user_update.token
    
    # Update states_counties if provided
    if user_update.states_counties is not None:
        # Validate that states and counties exist
        for state_county in user_update.states_counties:
            # Verify state exists
            state_exists = db.query(StatesCounties).filter(
                StatesCounties.statefips == str(state_county.state_FIPS)
            ).first()
            if not state_exists:
                raise HTTPException(status_code=400, detail=f"Invalid state FIPS: {state_county.state_FIPS}")
            
            # Verify counties exist
            for county in state_county.counties:
                county_exists = db.query(StatesCounties).filter(
                    StatesCounties.statefips == str(state_county.state_FIPS),
                    StatesCounties.countyfips == str(county.county_FIPS)
                ).first()
                if not county_exists:
                    raise HTTPException(status_code=400, detail=f"Invalid county FIPS: {county.county_FIPS} for state: {state_county.state_FIPS}")
        
        current_user.states_counties = [sc.dict() for sc in user_update.states_counties]
    
    # Commit all changes
    try:
        db.commit()
        db.refresh(current_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update profile")
    
    return current_user

@app.get("/companies/list")
def get_companies_list(db: Session = Depends(get_db)):
    """
    Get list of companies for dropdown selection
    """
    companies = db.query(Company.id, Company.name, Company.companycode).all()
    return [
        {
            "id": company.id,
            "name": company.name,
            "companycode": company.companycode
        }
        for company in companies
    ]

# Existing endpoints
@app.get("/states_counties", response_model=List[StateCounties])
def get_states_counties(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT statefips, state, countyfips, county FROM states_counties
    """)).fetchall()

    data = {}
    for row in result:
        statefips = row.statefips
        if statefips not in data:
            data[statefips] = {
                "state_FIPS": statefips,
                "state_name": row.state,
                "counties": []
            }
        data[statefips]["counties"].append({
            "county_FIPS": row.countyfips,
            "county_name": row.county,
        })
    return list(data.values())

@app.post("/companies", response_model=CompanyOut)
def create_company(company: CompanyCreate, db: Session = Depends(get_db)):
    existing = db.query(Company).filter(Company.companycode == company.companycode).first()
    if existing:
        raise HTTPException(status_code=400, detail="Company code already exists")

    db_company = Company(
        name=company.name,
        companycode=company.companycode,
        password=hash_password(company.password),
    )
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

@app.post("/crm_owners", response_model=OwnerOut)
def create_owner(owner: OwnerCreate, db: Session = Depends(get_db)):
    # Check companycode exists
    company = db.query(Company).filter(Company.companycode == owner.companycode).first()
    if not company:
        raise HTTPException(status_code=400, detail="Invalid company code")

    # Check unique email for owner
    existing_owner = db.query(CrmOwner).filter(CrmOwner.email == owner.email).first()
    if existing_owner:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_owner = CrmOwner(
        name=owner.name,
        email=owner.email,
        token=owner.token,
        companycode=owner.companycode,
        password=hash_password(owner.password),
        states_counties=[sc.dict() for sc in owner.states_counties],
    )
    db.add(db_owner)
    db.commit()
    db.refresh(db_owner)
    return db_owner

# endpoint for token validation
@app.get("/validate-token")
def validate_token(current_user: CrmOwner = Depends(get_current_user)):
    """
    Validate the current token and return user info.
    This endpoint is useful for checking if a session is still valid.
    """
    return {
        "valid": True,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "companycode": current_user.companycode,
            "states_counties": current_user.states_counties
        },
        "timestamp": datetime.utcnow().isoformat()
    }
# Seen Properties endpoints
@app.get("/seen_properties", response_model=List[SeenPropertyOut])
def get_seen_properties(current_user: CrmOwner = Depends(get_current_user), db: Session = Depends(get_db)):
    properties = db.query(SeenProperties).filter(
        SeenProperties.crm_owner_id == current_user.id
    ).order_by(SeenProperties.created_at.desc()).all()
    return properties

@app.get("/seen_properties/stats")
def get_seen_properties_stats(current_user: CrmOwner = Depends(get_current_user), db: Session = Depends(get_db)):
    total_properties = db.query(SeenProperties).filter(
        SeenProperties.crm_owner_id == current_user.id
    ).count()
    
    # Get properties by state
    state_stats = db.execute(text("""
        SELECT state, COUNT(*) as count 
        FROM seen_properties 
        WHERE crm_owner_id = :user_id AND state IS NOT NULL
        GROUP BY state
        ORDER BY count DESC
    """), {"user_id": current_user.id}).fetchall()
    
    # Recent properties added to system (last 7 days) - use created_at
    recent_properties = db.execute(text("""
        SELECT COUNT(*) as count
        FROM seen_properties 
        WHERE crm_owner_id = :user_id 
        AND created_at >= NOW() - INTERVAL '7 days'
    """), {"user_id": current_user.id}).fetchone()
    
    # Properties with recent contracts (last 30 days) - use contract_date
    recent_contracts = db.execute(text("""
        SELECT COUNT(*) as count
        FROM seen_properties 
        WHERE crm_owner_id = :user_id 
        AND contract_date IS NOT NULL
        AND contract_date >= NOW() - INTERVAL '30 days'
    """), {"user_id": current_user.id}).fetchone()
    
    return {
        "total_properties": total_properties,
        "recent_properties": recent_properties.count if recent_properties else 0,
        "recent_contracts": recent_contracts.count if recent_contracts else 0,
        "state_breakdown": [{"state": row.state, "count": row.count} for row in state_stats]
    }

# endpoint to filter by contract_date when specified
@app.get("/seen_properties/paginated")
def get_seen_properties_paginated(
    page: int = 1,
    page_size: int = 20,
    state: str = None,
    county: str = None,
    days_back: int = None,
    contract_days_back: int = None,  # New parameter for filtering by contract_date
    current_user: CrmOwner = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get seen properties with pagination and filtering options.
    """
    query = db.query(SeenProperties).filter(
        SeenProperties.crm_owner_id == current_user.id
    )
    
    # Apply filters
    if state:
        query = query.filter(SeenProperties.state.ilike(f"%{state}%"))
    
    if county:
        query = query.filter(SeenProperties.county.ilike(f"%{county}%"))
    
    # Filter by when property was added to system
    if days_back:
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        query = query.filter(SeenProperties.created_at >= cutoff_date)
    
    # Filter by contract date
    if contract_days_back:
        cutoff_date = datetime.utcnow() - timedelta(days=contract_days_back)
        query = query.filter(
            SeenProperties.contract_date.isnot(None),
            SeenProperties.contract_date >= cutoff_date
        )
    
    # Get total count
    total = query.count()
    
    # Apply pagination - order by contract_date first (most recent contracts), then created_at
    properties = query.order_by(
        SeenProperties.contract_date.desc().nulls_last(),
        SeenProperties.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "properties": properties,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": page * page_size < total,
            "has_prev": page > 1
        }
    }

# endpoint to provide better insights
@app.get("/seen_properties/analytics")
def get_detailed_analytics(
    current_user: CrmOwner = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed analytics about seen properties.
    """
    base_query = db.query(SeenProperties).filter(
        SeenProperties.crm_owner_id == current_user.id
    )
    
    # Total properties
    total_properties = base_query.count()
    
    # Properties added to system by time periods (created_at)
    now = datetime.utcnow()
    last_7_days = base_query.filter(SeenProperties.created_at >= now - timedelta(days=7)).count()
    last_30_days = base_query.filter(SeenProperties.created_at >= now - timedelta(days=30)).count()
    last_90_days = base_query.filter(SeenProperties.created_at >= now - timedelta(days=90)).count()
    
    # Contract-based analytics (contract_date)
    properties_with_contracts = base_query.filter(SeenProperties.contract_date.isnot(None)).count()
    recent_contracts_30_days = base_query.filter(
        SeenProperties.contract_date.isnot(None),
        SeenProperties.contract_date >= now - timedelta(days=30)
    ).count()
    recent_contracts_60_days = base_query.filter(
        SeenProperties.contract_date.isnot(None),
        SeenProperties.contract_date >= now - timedelta(days=60)
    ).count()
    
    # State breakdown with contract insights
    state_stats = db.execute(text("""
        SELECT 
            state, 
            COUNT(*) as count,
            COUNT(DISTINCT county) as unique_counties,
            AVG(EXTRACT(DAY FROM (NOW() - created_at))) as avg_days_in_system,
            COUNT(CASE WHEN contract_date IS NOT NULL THEN 1 END) as properties_with_contracts,
            AVG(CASE WHEN contract_date IS NOT NULL 
                THEN EXTRACT(DAY FROM (NOW() - contract_date)) 
                END) as avg_contract_days_old
        FROM seen_properties 
        WHERE crm_owner_id = :user_id AND state IS NOT NULL
        GROUP BY state
        ORDER BY count DESC
    """), {"user_id": current_user.id}).fetchall()
    
    # County breakdown
    county_stats = db.execute(text("""
        SELECT 
            county,
            state,
            COUNT(*) as count,
            COUNT(CASE WHEN contract_date IS NOT NULL THEN 1 END) as properties_with_contracts
        FROM seen_properties 
        WHERE crm_owner_id = :user_id AND county IS NOT NULL
        GROUP BY county, state
        ORDER BY count DESC
        LIMIT 10
    """), {"user_id": current_user.id}).fetchall()
    
    # Monthly trend for properties added to system (created_at)
    monthly_stats = db.execute(text("""
        SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as count
        FROM seen_properties 
        WHERE crm_owner_id = :user_id 
        AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
    """), {"user_id": current_user.id}).fetchall()
    
    # Contract date distribution
    contract_age_stats = db.execute(text("""
        SELECT 
            CASE 
                WHEN contract_date IS NULL THEN 'No Contract Date'
                WHEN contract_date >= NOW() - INTERVAL '30 days' THEN 'Last 30 Days'
                WHEN contract_date >= NOW() - INTERVAL '60 days' THEN '31-60 Days'
                WHEN contract_date >= NOW() - INTERVAL '90 days' THEN '61-90 Days'
                ELSE 'Over 90 Days'
            END as age_group,
            COUNT(*) as count
        FROM seen_properties 
        WHERE crm_owner_id = :user_id
        GROUP BY 
            CASE 
                WHEN contract_date IS NULL THEN 'No Contract Date'
                WHEN contract_date >= NOW() - INTERVAL '30 days' THEN 'Last 30 Days'
                WHEN contract_date >= NOW() - INTERVAL '60 days' THEN '31-60 Days'
                WHEN contract_date >= NOW() - INTERVAL '90 days' THEN '61-90 Days'
                ELSE 'Over 90 Days'
            END
        ORDER BY count DESC
    """), {"user_id": current_user.id}).fetchall()
    
    # Properties with contact info
    properties_with_contacts = base_query.filter(
        SeenProperties.contact_email.isnot(None)
    ).count()
    
    return {
        "summary": {
            "total_properties": total_properties,
            "last_7_days_added": last_7_days,
            "last_30_days_added": last_30_days,
            "last_90_days_added": last_90_days,
            "properties_with_contracts": properties_with_contracts,
            "contract_rate": round((properties_with_contracts / total_properties * 100), 2) if total_properties > 0 else 0,
            "recent_contracts_30_days": recent_contracts_30_days,
            "recent_contracts_60_days": recent_contracts_60_days,
            "properties_with_contacts": properties_with_contacts,
            "contact_rate": round((properties_with_contacts / total_properties * 100), 2) if total_properties > 0 else 0
        },
        "state_breakdown": [
            {
                "state": row.state,
                "count": row.count,
                "unique_counties": row.unique_counties,
                "avg_days_in_system": round(row.avg_days_in_system, 1) if row.avg_days_in_system else 0,
                "properties_with_contracts": row.properties_with_contracts,
                "avg_contract_days_old": round(row.avg_contract_days_old, 1) if row.avg_contract_days_old else 0
            }
            for row in state_stats
        ],
        "top_counties": [
            {
                "county": row.county,
                "state": row.state,
                "count": row.count,
                "properties_with_contracts": row.properties_with_contracts
            }
            for row in county_stats
        ],
        "monthly_trend": [
            {
                "month": row.month.strftime("%Y-%m") if row.month else None,
                "count": row.count
            }
            for row in monthly_stats
        ],
        "contract_age_distribution": [
            {
                "age_group": row.age_group,
                "count": row.count
            }
            for row in contract_age_stats
        ]
    }

@app.get("/user/activity-summary")
def get_user_activity_summary(
    current_user: CrmOwner = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a summary of user's recent activity and system status.
    """
    # Recent properties (last 5) - ordered by contract_date first, then created_at
    recent_properties = db.query(SeenProperties).filter(
        SeenProperties.crm_owner_id == current_user.id
    ).order_by(
        SeenProperties.contract_date.desc().nulls_last(),
        SeenProperties.created_at.desc()
    ).limit(5).all()
    
    # Get user's assigned states/counties count
    states_count = len(current_user.states_counties) if current_user.states_counties else 0
    counties_count = sum(
        len(state.get('counties', [])) 
        for state in (current_user.states_counties or [])
    )
    
    # Last system activity timestamp (created_at)
    last_system_activity = db.query(SeenProperties.created_at).filter(
        SeenProperties.crm_owner_id == current_user.id
    ).order_by(SeenProperties.created_at.desc()).first()

    # Most recent contract date
    most_recent_contract = db.query(SeenProperties.contract_date).filter(
        SeenProperties.crm_owner_id == current_user.id,
        SeenProperties.contract_date.isnot(None)
    ).order_by(SeenProperties.contract_date.desc()).first()
    
    return {
        "user_info": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "companycode": current_user.companycode,
            "assigned_states": states_count,
            "assigned_counties": counties_count
        },
        "recent_properties": [
            {
                "id": prop.id,
                "property_id": prop.property_id,
                "street_address": prop.street_address,
                "county": prop.county,
                "state": prop.state,
                "created_at": prop.created_at,
                "contract_date": prop.contract_date,
                "days_in_system": (datetime.utcnow() - prop.created_at).days,
                "contract_days_ago": (datetime.utcnow() - prop.contract_date).days if prop.contract_date else None
            }
            for prop in recent_properties
        ],
        "last_system_activity": last_system_activity[0].isoformat() if last_system_activity and last_system_activity[0] else None,
        "most_recent_contract": most_recent_contract[0].isoformat() if most_recent_contract and most_recent_contract[0] else None,
        "session_info": {
            "current_time": datetime.utcnow().isoformat(),
            "timezone": "UTC"
        }
    }

# Add error handling middleware
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle unexpected errors and return a proper JSON response.
    """
    print(f"Unexpected error: {exc}")  # Log the error
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred. Please try again later.",
            "error_type": type(exc).__name__
        }
    )


# Admin authentication endpoints
@app.post("/admin/login", response_model=AdminLoginResponse)
def admin_login(admin_data: AdminLogin, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.username == admin_data.username).first()
    if not admin or not verify_password(admin_data.password, admin.password) or not admin.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Update last login
    admin.last_login = datetime.utcnow()
    db.commit()
    
    access_token = create_admin_token(data={"admin_id": admin.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "admin": admin
    }

@app.get("/admin/me", response_model=AdminOut)
def get_current_admin_info(current_admin: Admin = Depends(get_current_admin)):
    return current_admin

# User management endpoints
@app.get("/admin/users")
def get_all_users(
    page: int = 1,
    page_size: int = 20,
    search: str = None,
    company: str = None,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(CrmOwner)
    
    if search:
        query = query.filter(
            CrmOwner.name.ilike(f"%{search}%") | 
            CrmOwner.email.ilike(f"%{search}%")
        )
    
    if company:
        query = query.filter(CrmOwner.companycode.ilike(f"%{company}%"))
    
    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    
    # Add detailed property stats for each user
    users_with_properties = []
    for user in users:
        # Total properties
        total_properties = db.query(SeenProperties).filter(
            SeenProperties.crm_owner_id == user.id
        ).count()
        
        # Recent properties (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_properties = db.query(SeenProperties).filter(
            SeenProperties.crm_owner_id == user.id,
            SeenProperties.created_at >= thirty_days_ago
        ).count()
        
        # Properties with contracts
        properties_with_contracts = db.query(SeenProperties).filter(
            SeenProperties.crm_owner_id == user.id,
            SeenProperties.contract_date.isnot(None)
        ).count()
        
        user_dict = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "companycode": user.companycode,
            "states_counties": user.states_counties,
            "property_count": total_properties,
            "recent_properties": recent_properties,
            "properties_with_contracts": properties_with_contracts,
            "assigned_states": len(user.states_counties) if user.states_counties else 0
        }
        users_with_properties.append(user_dict)
    
    return {
        "users": users_with_properties,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": page * page_size < total,
            "has_prev": page > 1
        }
    }

@app.get("/admin/companies")
def get_all_companies(current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    companies = db.query(Company).all()
    
    # Add user counts for each company
    company_stats = []
    for company in companies:
        user_count = db.query(CrmOwner).filter(CrmOwner.companycode == company.companycode).count()
        company_stats.append({
            "id": company.id,
            "name": company.name,
            "companycode": company.companycode,
            "user_count": user_count,
            "created_at": getattr(company, 'created_at', None)
        })
    
    return company_stats

@app.get("/admin/stats")
def get_admin_stats(current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    # Basic counts
    total_users = db.query(CrmOwner).count()
    total_companies = db.query(Company).count()
    total_properties = db.query(SeenProperties).count()
    
    # Recent signups (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_signups = db.query(CrmOwner).filter(CrmOwner.id > 0).count()  # Adjust based on your created_at field
    
    # Users by company
    users_by_company = db.execute(text("""
        SELECT companycode, COUNT(*) as count 
        FROM crm_owners 
        GROUP BY companycode
        ORDER BY count DESC
        LIMIT 10
    """)).fetchall()
    
    # Properties by month (last 6 months)
    properties_by_month = db.execute(text("""
        SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as count
        FROM seen_properties 
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
    """)).fetchall()
    
    # Top performing states
    top_states = db.execute(text("""
        SELECT state, COUNT(*) as count 
        FROM seen_properties 
        WHERE state IS NOT NULL
        GROUP BY state
        ORDER BY count DESC
        LIMIT 10
    """)).fetchall()
    
    return {
        "overview": {
            "total_users": total_users,
            "total_companies": total_companies,
            "total_properties": total_properties,
            "recent_signups": recent_signups
        },
        "users_by_company": [{"company": row.companycode, "count": row.count} for row in users_by_company],
        "properties_by_month": [{"month": row.month.strftime("%Y-%m"), "count": row.count} for row in properties_by_month],
        "top_states": [{"state": row.state, "count": row.count} for row in top_states]
    }

@app.delete("/admin/users/{user_id}")
def delete_user(
    user_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if current_admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    user = db.query(CrmOwner).filter(CrmOwner.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete associated seen properties
    db.query(SeenProperties).filter(SeenProperties.crm_owner_id == user_id).delete()
    
    # Delete user
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted successfully"}

@app.put("/admin/users/{user_id}/toggle-status")
def toggle_user_status(
    user_id: int,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(CrmOwner).filter(CrmOwner.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add is_active field if it doesn't exist
    # user.is_active = not getattr(user, 'is_active', True)
    # For now, we'll use a different approach
    
    db.commit()
    return {"message": "User status updated successfully"}


# =============================================================================
# COMPANY AUTHENTICATION ENDPOINTS
# =============================================================================

@app.post("/company/login", response_model=CompanyLoginResponse)
def company_login(login_data: CompanyLogin, db: Session = Depends(get_db)):
    """Login endpoint for companies"""
    company = db.query(Company).filter(Company.companycode == login_data.companycode).first()
    if not company or not verify_password(login_data.password, company.password):
        raise HTTPException(status_code=401, detail="Invalid company code or password")
    
    access_token = create_company_token(data={"company_id": company.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "company": company
    }

@app.get("/company/me", response_model=CompanyOut)
def get_current_company_info(current_company: Company = Depends(get_current_company)):
    """Get current company information"""
    return current_company

@app.put("/company/me", response_model=CompanyOut)
def update_current_company(
    company_update: CompanyUpdate,
    current_company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Update current company information"""
    
    # Handle password change if requested
    if company_update.current_password and company_update.new_password:
        # Verify current password
        if not verify_password(company_update.current_password, current_company.password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Update to new password
        current_company.password = hash_password(company_update.new_password)
    elif company_update.current_password or company_update.new_password:
        # If only one password field is provided, require both
        raise HTTPException(status_code=400, detail="Both current and new passwords are required for password change")

    # Update company name if provided
    if company_update.name is not None:
        current_company.name = company_update.name
    
    # Commit changes
    try:
        db.commit()
        db.refresh(current_company)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update company")
    
    return current_company

# =============================================================================
# COMPANY AGENT MANAGEMENT ENDPOINTS
# =============================================================================

@app.get("/company/agents", response_model=List[AgentOutForCompany])
def get_company_agents(current_company: Company = Depends(get_current_company), db: Session = Depends(get_db)):
    """Get all agents belonging to the current company"""
    
    # Get all agents for this company
    agents = db.query(CrmOwner).filter(CrmOwner.companycode == current_company.companycode).all()
    
    # Add additional information for each agent
    agents_with_stats = []
    for agent in agents:
        # Count properties for this agent
        property_count = db.query(SeenProperties).filter(SeenProperties.crm_owner_id == agent.id).count()
        
        # Count assigned states
        assigned_states = len(agent.states_counties) if agent.states_counties else 0

        agent_dict = {
            "id": agent.id,
            "name": agent.name,
            "email": agent.email,
            "token": agent.token,
            "companycode": agent.companycode,
            "states_counties": agent.states_counties,
            "property_count": property_count,
            "assigned_states": assigned_states,
            "is_active": True,  # You can add an is_active field to CrmOwner model if needed
            "created_at": datetime.utcnow(),  # You can add created_at field to CrmOwner model if needed
            "last_login": None  # You can add last_login field to CrmOwner model if needed
        }
        agents_with_stats.append(agent_dict)
    
    return agents_with_stats

@app.post("/company/agents", response_model=AgentOutForCompany)
def create_company_agent(
    agent_data: AgentCreateByCompany,
    current_company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Create a new agent for the current company"""
    
    # Check if email already exists
    existing_agent = db.query(CrmOwner).filter(CrmOwner.email == agent_data.email).first()
    if existing_agent:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate states and counties if provided
    if agent_data.states_counties:
        for state_county in agent_data.states_counties:
            # Verify state exists
            state_exists = db.query(StatesCounties).filter(
                StatesCounties.statefips == str(state_county.state_FIPS)
            ).first()
            if not state_exists:
                raise HTTPException(status_code=400, detail=f"Invalid state FIPS: {state_county.state_FIPS}")
            
            # Verify counties exist
            for county in state_county.counties:
                county_exists = db.query(StatesCounties).filter(
                    StatesCounties.statefips == str(state_county.state_FIPS),
                    StatesCounties.countyfips == str(county.county_FIPS)
                ).first()
                if not county_exists:
                    raise HTTPException(status_code=400, detail=f"Invalid county FIPS: {county.county_FIPS} for state: {state_county.state_FIPS}")
    
    # Create new agent
    db_agent = CrmOwner(
        name=agent_data.name,
        email=agent_data.email,
        token=agent_data.token,
        companycode=current_company.companycode,
        password=hash_password(agent_data.password),
        states_counties=[sc.dict() for sc in agent_data.states_counties] if agent_data.states_counties else [],
    )
    
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    
    # Return agent with stats
    return {
        "id": db_agent.id,
        "name": db_agent.name,
        "email": db_agent.email,
        "token": db_agent.token,
        "companycode": db_agent.companycode,
        "states_counties": db_agent.states_counties,
        "property_count": 0,
        "assigned_states": len(db_agent.states_counties) if db_agent.states_counties else 0,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "last_login": None
    }

@app.put("/company/agents/{agent_id}", response_model=AgentOutForCompany)
def update_company_agent(
    agent_id: int,
    agent_update: OwnerUpdate,
    current_company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Update an agent belonging to the current company"""
    
    # Get the agent and verify it belongs to the current company
    agent = db.query(CrmOwner).filter(
        CrmOwner.id == agent_id,
        CrmOwner.companycode == current_company.companycode
    ).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found or doesn't belong to your company")
    
    # Update agent fields
    if agent_update.name is not None:
        agent.name = agent_update.name
    
    if agent_update.email is not None:
        # Check if email is already taken by another agent
        existing = db.query(CrmOwner).filter(
            CrmOwner.email == agent_update.email,
            CrmOwner.id != agent.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        agent.email = agent_update.email
    
    if agent_update.token is not None:
        agent.token = agent_update.token
    
    # Handle password change
    if agent_update.current_password and agent_update.new_password:
        if not verify_password(agent_update.current_password, agent.password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        agent.password = hash_password(agent_update.new_password)
    
    # Update states_counties if provided
    if agent_update.states_counties is not None:
        # Validate states and counties
        for state_county in agent_update.states_counties:
            state_exists = db.query(StatesCounties).filter(
                StatesCounties.statefips == str(state_county.state_FIPS)
            ).first()
            if not state_exists:
                raise HTTPException(status_code=400, detail=f"Invalid state FIPS: {state_county.state_FIPS}")
            
            for county in state_county.counties:
                county_exists = db.query(StatesCounties).filter(
                    StatesCounties.statefips == str(state_county.state_FIPS),
                    StatesCounties.countyfips == str(county.county_FIPS)
                ).first()
                if not county_exists:
                    raise HTTPException(status_code=400, detail=f"Invalid county FIPS: {county.county_FIPS} for state: {state_county.state_FIPS}")

        agent.states_counties = [sc.dict() for sc in agent_update.states_counties]
    
    # Commit changes
    try:
        db.commit()
        db.refresh(agent)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update agent")
    
    # Return updated agent with stats
    property_count = db.query(SeenProperties).filter(SeenProperties.crm_owner_id == agent.id).count()
    assigned_states = len(agent.states_counties) if agent.states_counties else 0
    
    return {
        "id": agent.id,
        "name": agent.name,
        "email": agent.email,
        "token": agent.token,
        "companycode": agent.companycode,
        "states_counties": agent.states_counties,
        "property_count": property_count,
        "assigned_states": assigned_states,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "last_login": None
    }

@app.delete("/company/agents/{agent_id}")
def delete_company_agent(
    agent_id: int,
    current_company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Delete an agent belonging to the current company"""
    
    # Get the agent and verify it belongs to the current company
    agent = db.query(CrmOwner).filter(
        CrmOwner.id == agent_id,
        CrmOwner.companycode == current_company.companycode
    ).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found or doesn't belong to your company")
    
    # Delete associated seen properties
    db.query(SeenProperties).filter(SeenProperties.crm_owner_id == agent_id).delete()
    
    # Delete the agent
    db.delete(agent)
    db.commit()
    
    return {"message": "Agent deleted successfully"}

@app.put("/company/agents/{agent_id}/toggle-status")
def toggle_agent_status(
    agent_id: int,
    current_company: Company = Depends(get_current_company),
    db: Session = Depends(get_db)
):
    """Toggle agent active status (placeholder - you may need to add is_active field to CrmOwner model)"""
    
    # Get the agent and verify it belongs to the current company
    agent = db.query(CrmOwner).filter(
        CrmOwner.id == agent_id,
        CrmOwner.companycode == current_company.companycode
    ).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found or doesn't belong to your company")
    
    # Note: You may want to add an 'is_active' boolean field to your CrmOwner model
    # For now, this endpoint exists but doesn't actually toggle anything
    # agent.is_active = not agent.is_active
    # db.commit()
    
    return {"message": "Agent status toggled successfully"}

# =============================================================================
# COMPANY STATISTICS AND ANALYTICS ENDPOINTS
# =============================================================================

@app.get("/company/stats", response_model=CompanyStats)
def get_company_stats(current_company: Company = Depends(get_current_company), db: Session = Depends(get_db)):
    """Get company statistics"""
    
    # Get all agents for this company
    agents = db.query(CrmOwner).filter(CrmOwner.companycode == current_company.companycode).all()
    total_agents = len(agents)
    active_agents = total_agents  # Placeholder - you may want to add is_active field
    
    # Get total properties for all company agents
    agent_ids = [agent.id for agent in agents]
    total_properties = 0
    if agent_ids:
        total_properties = db.query(SeenProperties).filter(SeenProperties.crm_owner_id.in_(agent_ids)).count()
    
    # Get monthly properties (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    monthly_properties = 0
    if agent_ids:
        monthly_properties = db.query(SeenProperties).filter(
            SeenProperties.crm_owner_id.in_(agent_ids),
            SeenProperties.created_at >= thirty_days_ago
        ).count()
    
    # Recent signups (last 30 days) - placeholder
    recent_signups = db.query(CrmOwner).filter(
        CrmOwner.companycode == current_company.companycode
        # Add created_at filter when you have the field
    ).count()
    
    return {
        "total_agents": total_agents,
        "active_agents": active_agents,
        "total_properties": total_properties,
        "monthly_properties": monthly_properties,
        "recent_signups": recent_signups
    }

@app.get("/company/analytics", response_model=CompanyAnalytics)
def get_company_analytics(current_company: Company = Depends(get_current_company), db: Session = Depends(get_db)):
    """Get company analytics"""
    
    # Get all agents for this company
    agents = db.query(CrmOwner).filter(CrmOwner.companycode == current_company.companycode).all()
    agent_ids = [agent.id for agent in agents]
    
    # Top performing agents
    top_agents = []
    for agent in agents:
        property_count = db.query(SeenProperties).filter(SeenProperties.crm_owner_id == agent.id).count()
        top_agents.append({
            "id": agent.id,
            "name": agent.name,
            "properties_count": property_count
        })
    
    # Sort by property count
    top_agents.sort(key=lambda x: x["properties_count"], reverse=True)
    
    # Properties by month (last 6 months)
    properties_by_month = []
    if agent_ids:
        monthly_stats = db.execute(text("""
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as count
            FROM seen_properties 
            WHERE crm_owner_id = ANY(:agent_ids)
            AND created_at >= NOW() - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month DESC
        """), {"agent_ids": agent_ids}).fetchall()

        properties_by_month = [
            {
                "month": row.month.strftime("%Y-%m") if row.month else None,
                "count": row.count
            }
            for row in monthly_stats
        ]
    
    # State breakdown
    state_breakdown = []
    if agent_ids:
        state_stats = db.execute(text("""
            SELECT state, COUNT(*) as count 
            FROM seen_properties 
            WHERE crm_owner_id = ANY(:agent_ids) AND state IS NOT NULL
            GROUP BY state
            ORDER BY count DESC
        """), {"agent_ids": agent_ids}).fetchall()

        state_breakdown = [{"state": row.state, "count": row.count} for row in state_stats]
    
    # Performance metrics
    performance_metrics = {
        "avg_properties_per_agent": len(agent_ids) and sum(agent["properties_count"] for agent in top_agents) / len(agent_ids) or 0,
        "total_coverage_states": len(set(state["state"] for state in state_breakdown)),
        "most_active_state": state_breakdown[0]["state"] if state_breakdown else None
    }
    
    return {
        "top_agents": top_agents,
        "properties_by_month": properties_by_month,
        "state_breakdown": state_breakdown,
        "performance_metrics": performance_metrics
    }


# System health endpoints
@app.get("/admin/system/health")
def get_system_health(current_admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    try:
        # Test database connection
        db.execute(text("SELECT 1"))

        # Get recent activity
        recent_properties = db.query(SeenProperties).filter(
            SeenProperties.created_at >= datetime.utcnow() - timedelta(hours=24)
        ).count()

        # Check for failed tasks (you'll need to implement this based on your worker monitoring)

        return {
            "status": "healthy",
            "database": "connected",
            "recent_activity": {
                "properties_last_24h": recent_properties
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )


# Health check with database connectivity
@app.get("/health/detailed")
def detailed_health_check(db: Session = Depends(get_db)):
    """
    Detailed health check including database connectivity.
    """
    try:
        # Test database connection
        db.execute(text("SELECT 1"))

        # Get basic stats
        total_users = db.query(CrmOwner).count()
        total_companies = db.query(Company).count()
        total_properties = db.query(SeenProperties).count()

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "stats": {
                "total_users": total_users,
                "total_companies": total_companies,
                "total_properties": total_properties
            }
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "database": "disconnected",
                "error": str(e)
            }
        )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

@app.get("/health")
def health():
    return {"status": "ok"}
