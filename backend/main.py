import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String, JSON, UniqueConstraint
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from dotenv import load_dotenv

load_dotenv()  # load env vars from .env if present

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("DATABASE_URL environment variable not set")

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
    password = Column(String, nullable=False)

class CrmOwner(Base):
    __tablename__ = "crm_owners"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    token = Column(String, nullable=False)
    companycode = Column(String, nullable=False)  # Should match Company.companycode
    password = Column(String, nullable=False)
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

class CompanyCreate(CompanyBase):
    pass

class CompanyOut(CompanyBase):
    id: int

# CRM Owner schemas
class OwnerBase(BaseModel):
    name: str
    email: EmailStr
    token: str
    company_code: str
    password: str
    states_counties: List[StateCounties]

class OwnerCreate(OwnerBase):
    pass

class OwnerOut(OwnerBase):
    id: int

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
    # Adjust to your actual table and column names
    result = db.execute("""
        SELECT statefips, state, countyfips, county FROM states_counties_table
    """).fetchall()

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
        password=company.password,  # TODO: hash in production
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

    db_owner = CrmOwner(
        name=owner.name,
        email=owner.email,
        token=owner.token,
        companycode=owner.company_code,
        password=owner.password,  # TODO: hash in production
        states_counties=[sc.dict() for sc in owner.states_counties],
    )
    db.add(db_owner)
    db.commit()
    db.refresh(db_owner)
    return db_owner

@app.get("/health")
def health():
    return {"status": "ok"}
