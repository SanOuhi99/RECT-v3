from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
import csv, uuid, os, datetime, json
import pathlib, os


app = FastAPI()
DATA_DIR = "/app/data"

CSV_PATH =  "states_counties.csv"

DB_FILE    = "/app/crm_owners.json"

# ---------- helper ---------- #
def load_states_counties():
    if not os.path.exists(CSV_FILE):
        print("CSV file not found")
        return
    data = {}
    with open(CSV_PATH, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = row['state_FIPS']
            if key not in data:
                data[key] = {
                    "state_FIPS": int(key),
                    "state_name": row['state_name'],
                    "counties": []
                }
            data[key]["counties"].append({
                "county_name": row['county_name'],
                "county_FIPS": int(row['county_FIPS'])
            })
    return list(data.values())

# ---------- GET /states_counties ---------- #
@app.get("/states_counties")
def states_counties():
    return load_states_counties()

# ---------- POST /crm_owners ---------- #
class OwnerIn(BaseModel):
    name: str
    email: EmailStr
    token: str
    company_code: str
    states_counties: list   # identical to front-end payload

@app.post("/crm_owners")
def save_owner(owner: OwnerIn):
    new_owner = owner.dict()
    new_owner["id"] = str(uuid.uuid4())
    new_owner["created_at"] = datetime.datetime.utcnow().isoformat() + "Z"

    # load existing
    owners = []
    if os.path.exists(DB_FILE):
        owners = json.load(open(DB_FILE))

    owners.append(new_owner)
    json.dump(owners, open(DB_FILE, "w"), indent=2)
    return new_owner

@app.get("/health")
def health():
    return {"status": "ok"}
