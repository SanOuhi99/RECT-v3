import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy import create_engine, Column, Integer, String, JSON, text, UniqueConstraint
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()  # Load env vars from .env if present

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("DATABASE_URL environment variable not set")

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

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

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    companycode = Column(String, nullable=False, unique=True, index=True)
    password = Column(String, nullable=False)  # hashed password

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

# Create tables (run once at startup)
Base.metadata.create_all(bind=engine)

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
    company_code: str
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
    company_code: str
    states_counties: List[StateCounties]

    class Config:
        orm_mode = True

# --- FastAPI app ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://frontend-rectenvironment.up.railway.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/states_counties", response_model=List[StateCounties])
def get_states_counties(db: Session = Depends(get_db)):
    # Replace with your real table name, adjust query if needed
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
    company = db.query(Company).filter(Company.companycode == owner.company_code).first()
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
        companycode=owner.company_code,
        password=hash_password(owner.password),
        states_counties=[sc.dict() for sc in owner.states_counties],
    )
    db.add(db_owner)
    db.commit()
    db.refresh(db_owner)
    return db_owner

@app.get("/health")
def health():
    return {"status": "ok"}
