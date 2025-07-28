from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, JSON, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

# ----- FastAPI setup -----
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://frontend-rectenvironment.up.railway.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- Database setup -----
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/dbname")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ----- Models -----
class CRMOwner(Base):
    __tablename__ = "crm_owners"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    email = Column(Text, nullable=False)
    token = Column(Text, nullable=False)
    companycode = Column(Text, nullable=False)
    password = Column(Text, nullable=False)
    seen_property_ids = Column(JSON)
    states_counties = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

# ----- Pydantic schema -----
class OwnerIn(BaseModel):
    name: str
    email: EmailStr
    token: str
    company_code: str
    password: str = ""
    seen_property_ids: list = []
    states_counties: list

# ----- API Endpoints -----
@app.post("/crm_owners")
def save_owner(owner: OwnerIn):
    db = SessionLocal()
    new_owner = CRMOwner(
        name=owner.name,
        email=owner.email,
        token=owner.token,
        companycode=owner.company_code,
        password=owner.password,
        seen_property_ids=owner.seen_property_ids,
        states_counties=owner.states_counties,
    )
    db.add(new_owner)
    db.commit()
    db.refresh(new_owner)
    db.close()
    return {
        "id": new_owner.id,
        "created_at": new_owner.created_at.isoformat() + "Z",
        "name": new_owner.name,
        "email": new_owner.email
    }

@app.get("/crm_owners")
def get_crm_owners():
    db = SessionLocal()
    owners = db.query(CRMOwner).all()
    db.close()
    return [
        {
            "id": owner.id,
            "name": owner.name,
            "email": owner.email,
            "token": owner.token,
            "company_code": owner.companycode,
            "seen_property_ids": owner.seen_property_ids,
            "states_counties": owner.states_counties,
            "created_at": owner.created_at.isoformat() + "Z"
        } for owner in owners
    ]

@app.get("/health")
def health():
    return {"status": "ok"}
