import os
from typing import List, Optional,Dict, Any
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, Request, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy import create_engine, Column, Integer, String, JSON, text, insert, UniqueConstraint, DateTime, func
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

# Authentication dependency
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

# --- Schemas ---

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

class CompanyOut(BaseModel):
    id: int
    name: str
    companycode: str

    class Config:
        orm_mode = True

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
    states_counties: Optional[List[StateCounties]] = None

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
    # Update only provided fields
    if user_update.name is not None:
        current_user.name = user_update.name
    if user_update.email is not None:
        # Check if email is already taken by another user
        existing = db.query(CrmOwner).filter(
            CrmOwner.email == user_update.email,
            CrmOwner.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = user_update.email
    if user_update.token is not None:
        current_user.token = user_update.token
    if user_update.states_counties is not None:
        current_user.states_counties = [sc.dict() for sc in user_update.states_counties]
    
    db.commit()
    db.refresh(current_user)
    return current_user


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

# Add this new endpoint for token validation
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

# Update the /seen_properties/paginated endpoint to filter by contract_date when specified
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

# Update the /seen_properties/analytics endpoint to provide better insights
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

# Update the /user/activity-summary endpoint to show both system and contract insights
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
