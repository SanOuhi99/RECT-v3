import os
import psycopg2
from psycopg2 import sql

database_url = os.getenv("DATABASE_URL")
table_name = os.getenv("TABLENAME")

def change_field_type():
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur = conn.cursor()
    
    cur.execute("""
    ALTER TABLE seen_properties
    ALTER COLUMN match_field TYPE TEXT
    USING match_field::TEXT;
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("Column type updated successfully ✅")


def truncate_table():
    database_url = os.getenv("DATABASE_URL")
    table_name = os.getenv("TABLENAME")

    if not database_url or not table_name:
        raise ValueError("DATABASE_URL and TABLENAME environment variables must be set.")

    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = True

        with conn.cursor() as cur:
            cur.execute(sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE")
                        .format(sql.Identifier(table_name)))
            print(f"✅ Table '{table_name}' truncated successfully.")

    except Exception as e:
        print("❌ Error while truncating table:", e)

    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    change_field_type()
