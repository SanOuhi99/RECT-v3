# worker/database/migration.py
"""
Database migration script to create worker tables without affecting existing backend tables
"""
import os
import sys
import logging
from pathlib import Path

# Add worker directory to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from database.models import Base, engine, get_db_session
from database.models import PropertyMatch, SearchLog, WorkerStatus, EmailNotification

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_existing_tables():
    """Check which tables already exist"""
    try:
        with engine.connect() as conn:
            # Check for existing backend tables
            result = conn.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            
            existing_tables = [row[0] for row in result]
            logger.info(f"Existing tables: {existing_tables}")
            
            # Check specifically for backend tables
            backend_tables = ['companies', 'crm_owners', 'states_counties']
            existing_backend_tables = [t for t in backend_tables if t in existing_tables]
            
            if existing_backend_tables:
                logger.info(f"Found existing backend tables: {existing_backend_tables}")
                return True, existing_tables
            else:
                logger.warning("No backend tables found - this might be a fresh database")
                return False, existing_tables
                
    except Exception as e:
        logger.error(f"Error checking existing tables: {e}")
        return False, []

def create_worker_tables_only():
    """Create only the new worker tables"""
    try:
        # List of worker table models
        worker_tables = [PropertyMatch, SearchLog, WorkerStatus, EmailNotification]
        
        logger.info("Creating worker-specific database tables...")
        
        # Create only worker tables
        for table_model in worker_tables:
            table_model.__table__.create(bind=engine, checkfirst=True)
            logger.info(f"Created/verified table: {table_model.__tablename__}")
        
        logger.info("Worker tables created successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Error creating worker tables: {e}")
        return False

def verify_table_structure():
    """Verify that all tables have the expected structure"""
    try:
        with engine.connect() as conn:
            # Check worker tables
            worker_table_checks = {
                'property_matches': [
                    'id', 'property_id', 'owner_name', 'street_address', 
                    'crm_owner_id', 'contact_name', 'created_at', 'is_new_match'
                ],
                'search_logs': [
                    'id', 'crm_owner_id', 'search_type', 'results_count', 
                    'started_at', 'success'
                ],
                'worker_status': [
                    'id', 'task_id', 'task_name', 'started_at', 'status',
                    'total_crm_owners', 'processed_crm_owners'
                ],
                'email_notifications': [
                    'id', 'crm_owner_id', 'email_type', 'subject', 
                    'sent_at', 'matches_count'
                ]
            }
            
            all_good = True
            
            for table_name, expected_columns in worker_table_checks.items():
                try:
                    result = conn.execute(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = '{table_name}' 
                        AND table_schema = 'public'
                        ORDER BY column_name
                    """)
                    
                    actual_columns = [row[0] for row in result]
                    
                    missing_columns = [col for col in expected_columns if col not in actual_columns]
                    
                    if missing_columns:
                        logger.error(f"Table {table_name} is missing columns: {missing_columns}")
                        all_good = False
                    else:
                        logger.info(f"Table {table_name}: ✓ All expected columns present")
                        
                except Exception as e:
                    logger.error(f"Error checking table {table_name}: {e}")
                    all_good = False
            
            return all_good
            
    except Exception as e:
        logger.error(f"Error verifying table structure: {e}")
        return False

def migrate_existing_crm_data():
    """Optionally migrate seen_property_ids from JSON files to database if needed"""
    try:
        logger.info("Checking for existing CRM data to migrate...")
        
        # Check if there's a crm_owners.json file to migrate
        json_file = Path("/app/data/crm_owners.json")
        
        if not json_file.exists():
            logger.info("No CRM JSON file found to migrate")
            return True
        
        import json
        
        with open(json_file, 'r') as f:
            json_crm_owners = json.load(f)
        
        logger.info(f"Found {len(json_crm_owners)} CRM owners in JSON file")
        
        # Update database records with seen_property_ids from JSON
        with get_db_session() as session:
            try:
                for json_owner in json_crm_owners:
                    email = json_owner.get('email')
                    seen_ids = json_owner.get('seen_property_ids', [])
                    
                    if email and seen_ids:
                        # Update the database record
                        result = session.execute(
                            """UPDATE crm_owners 
                               SET seen_property_ids = :seen_ids 
                               WHERE email = :email""",
                            {'seen_ids': json.dumps(list(seen_ids)) if isinstance(seen_ids, set) else seen_ids, 
                             'email': email}
                        )
                        
                        if result.rowcount > 0:
                            logger.info(f"Updated seen_property_ids for {email}")
                
                session.commit()
                logger.info("CRM data migration completed successfully")
                return True
                
            except Exception as e:
                session.rollback()
                logger.error(f"Error during CRM data migration: {e}")
                return False
                
    except Exception as e:
        logger.error(f"Error in migrate_existing_crm_data: {e}")
        return False

def run_migration():
    """Run the complete migration process"""
    logger.info("=== Starting Database Migration ===")
    
    # Step 1: Check existing tables
    has_backend_tables, existing_tables = check_existing_tables()
    
    if has_backend_tables:
        logger.info("✓ Backend tables detected - safe to proceed with worker table creation")
    else:
        logger.warning("⚠ No backend tables found - ensure backend has been deployed first")
        response = input("Continue anyway? (y/N): ")
        if response.lower() != 'y':
            logger.info("Migration cancelled by user")
            return False
    
    # Step 2: Create worker tables
    logger.info("Creating worker-specific tables...")
    if not create_worker_tables_only():
        logger.error("Failed to create worker tables")
        return False
    
    # Step 3: Verify table structure
    logger.info("Verifying table structure...")
    if not verify_table_structure():
        logger.error("Table structure verification failed")
        return False
    
    # Step 4: Migrate existing data if needed
    logger.info("Checking for data migration needs...")
    if not migrate_existing_crm_data():
        logger.warning("Data migration had issues, but continuing...")
    
    logger.info("=== Database Migration Completed Successfully ===")
    logger.info("Worker is now ready to use the PostgreSQL database!")
    
    return True

def test_database_connection():
    """Test database connection and basic operations"""
    try:
        logger.info("Testing database connection...")
        
        with get_db_session() as session:
            # Test basic query
            result = session.execute("SELECT 1 as test").fetchone()
            if result and result[0] == 1:
                logger.info("✓ Database connection test passed")
            else:
                logger.error("✗ Database connection test failed")
                return False
            
            # Test worker tables
            tables_to_test = ['property_matches', 'search_logs', 'worker_status', 'email_notifications']
            
            for table in tables_to_test:
                try:
                    count_result = session.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
                    count = count_result[0] if count_result else 0
                    logger.info(f"✓ Table {table}: {count} records")
                except Exception as e:
                    logger.error(f"✗ Error accessing table {table}: {e}")
                    return False
            
            # Test CRM owners table (from backend)
            try:
                crm_count = session.execute("SELECT COUNT(*) FROM crm_owners").fetchone()
                logger.info(f"✓ CRM owners table: {crm_count[0] if crm_count else 0} records")
            except Exception as e:
                logger.warning(f"⚠ Could not access crm_owners table: {e}")
        
        logger.info("Database connection and table tests completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Database migration for RECT worker')
    parser.add_argument('--test-only', action='store_true', help='Only test connection, do not migrate')
    parser.add_argument('--force', action='store_true', help='Force migration without prompts')
    
    args = parser.parse_args()
    
    if args.test_only:
        success = test_database_connection()
        sys.exit(0 if success else 1)
    else:
        success = run_migration()
        if success:
            # Also run connection test
            test_database_connection()
        sys.exit(0 if success else 1)
