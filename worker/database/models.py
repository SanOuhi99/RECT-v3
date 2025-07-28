# worker/database/models.py
import os
from sqlalchemy import create_engine, Column, Integer, String, JSON, DateTime, Text, Boolean, Float
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.sql import func
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("DATABASE_URL environment variable not set")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=5,
    pool_recycle=3600,  # Recycle connections after 1 hour
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db_session():
    """Get database session with proper cleanup"""
    session = SessionLocal()
    try:
        return session
    except Exception as e:
        session.close()
        raise e

# New models for worker data storage
class PropertyMatch(Base):
    """Store property matches found by the worker"""
    __tablename__ = "property_matches"
    
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(String, nullable=False, index=True)
    owner_name = Column(String, nullable=False)
    street_address = Column(String, nullable=True)
    county = Column(String, nullable=True)
    state = Column(String, nullable=True)
    seller_name = Column(String, nullable=True)
    sale_date = Column(DateTime, nullable=True)
    sale_price = Column(Float, nullable=True)
    
    # CRM relationship data
    crm_owner_id = Column(Integer, nullable=False, index=True)  # References crm_owners.id
    crm_owner_name = Column(String, nullable=False)
    crm_owner_email = Column(String, nullable=False)
    contact_name = Column(String, nullable=False)
    contact_email = Column(String, nullable=False)
    
    # Match metadata
    match_confidence = Column(Float, default=0.0)
    name_variation_used = Column(String, nullable=True)
    search_criteria = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    processed_at = Column(DateTime, nullable=True)
    email_sent_at = Column(DateTime, nullable=True)
    
    # Status tracking
    is_new_match = Column(Boolean, default=True)
    is_notified = Column(Boolean, default=False)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'property_id': self.property_id,
            'owner_name': self.owner_name,
            'street_address': self.street_address,
            'county': self.county,
            'state': self.state,
            'seller_name': self.seller_name,
            'sale_date': self.sale_date.isoformat() if self.sale_date else None,
            'sale_price': self.sale_price,
            'crm_owner_name': self.crm_owner_name,
            'contact_name': self.contact_name,
            'match_confidence': self.match_confidence,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_new_match': self.is_new_match
        }

class SearchLog(Base):
    """Log search operations for monitoring and debugging"""
    __tablename__ = "search_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    crm_owner_id = Column(Integer, nullable=False, index=True)
    crm_owner_name = Column(String, nullable=False)
    search_type = Column(String, nullable=False)  # 'property_search', 'contact_fetch', etc.
    
    # Search parameters
    state_fips = Column(Integer, nullable=True)
    county_fips = Column(Integer, nullable=True)
    contact_name = Column(String, nullable=True)
    search_criteria = Column(JSON, nullable=True)
    
    # Results
    results_count = Column(Integer, default=0)
    new_matches_count = Column(Integer, default=0)
    api_calls_made = Column(Integer, default=0)
    
    # Performance metrics
    duration_seconds = Column(Float, nullable=True)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)
    
    def mark_completed(self, success=True, error_message=None):
        """Mark the search as completed"""
        self.completed_at = func.now()
        self.success = success
        if error_message:
            self.error_message = error_message
        if self.started_at:
            self.duration_seconds = (datetime.now() - self.started_at).total_seconds()

class WorkerStatus(Base):
    """Track worker execution status and metrics"""
    __tablename__ = "worker_status"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, nullable=False, index=True)
    task_name = Column(String, nullable=False)
    
    # Execution details
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default='running')  # 'running', 'completed', 'failed', 'cancelled'
    
    # Progress tracking
    total_crm_owners = Column(Integer, default=0)
    processed_crm_owners = Column(Integer, default=0)
    total_contacts = Column(Integer, default=0)
    processed_contacts = Column(Integer, default=0)
    total_matches_found = Column(Integer, default=0)
    total_api_calls = Column(Integer, default=0)
    failed_api_calls = Column(Integer, default=0)
    
    # Results
    error_message = Column(Text, nullable=True)
    execution_log = Column(JSON, nullable=True)
    performance_metrics = Column(JSON, nullable=True)
    
    def update_progress(self, **kwargs):
        """Update progress metrics"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
    
    def mark_completed(self, status='completed', error_message=None):
        """Mark task as completed"""
        self.completed_at = func.now()
        self.status = status
        if error_message:
            self.error_message = error_message

class EmailNotification(Base):
    """Track email notifications sent to CRM owners"""
    __tablename__ = "email_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    crm_owner_id = Column(Integer, nullable=False, index=True)
    crm_owner_email = Column(String, nullable=False)
    
    # Email details
    email_type = Column(String, nullable=False)  # 'monthly_matches', 'alert', 'summary'
    subject = Column(String, nullable=False)
    
    # Content tracking
    matches_count = Column(Integer, default=0)
    attachment_filename = Column(String, nullable=True)
    attachment_size_bytes = Column(Integer, nullable=True)
    
    # Delivery tracking
    sent_at = Column(DateTime, default=func.now())
    delivery_status = Column(String, default='sent')  # 'sent', 'failed', 'bounced'
    error_message = Column(Text, nullable=True)
    
    # References
    task_id = Column(String, nullable=True)  # Link to worker task
    property_match_ids = Column(JSON, nullable=True)  # List of property match IDs included

# Create all tables
def create_tables():
    """Create all database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise

# Database utility functions
class DatabaseManager:
    """Utility class for database operations"""
    
    @staticmethod
    def save_property_match(session, property_data, crm_owner, contact_data, search_metadata=None):
        """Save a property match to the database"""
        try:
            property_match = PropertyMatch(
                property_id=property_data.get('PropertyId', ''),
                owner_name=property_data.get('OwnerNames', ''),
                street_address=property_data.get('StreetAddress', ''),
                county=property_data.get('County', ''),
                state=property_data.get('State', ''),
                seller_name=property_data.get('SellerName', ''),
                sale_date=property_data.get('SaleDate'),
                sale_price=property_data.get('SalePrice'),
                
                crm_owner_id=crm_owner.get('id', 0),
                crm_owner_name=crm_owner.get('Name', ''),
                crm_owner_email=crm_owner.get('email', ''),
                contact_name=contact_data.get('name', ''),
                contact_email=contact_data.get('email', ''),
                
                match_confidence=search_metadata.get('confidence', 0.0) if search_metadata else 0.0,
                name_variation_used=search_metadata.get('name_variation') if search_metadata else None,
                search_criteria=search_metadata,
                
                is_new_match=True,
                is_notified=False
            )
            
            session.add(property_match)
            session.commit()
            session.refresh(property_match)
            
            logger.debug(f"Saved property match: {property_match.property_id}")
            return property_match
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error saving property match: {e}")
            raise
    
    @staticmethod
    def log_search_operation(session, crm_owner, search_type, search_params, results_count=0, success=True, error_message=None):
        """Log a search operation"""
        try:
            search_log = SearchLog(
                crm_owner_id=crm_owner.get('id', 0),
                crm_owner_name=crm_owner.get('Name', ''),
                search_type=search_type,
                state_fips=search_params.get('state_fips'),
                county_fips=search_params.get('county_fips'),
                contact_name=search_params.get('contact_name'),
                search_criteria=search_params,
                results_count=results_count,
                success=success,
                error_message=error_message
            )
            
            session.add(search_log)
            session.commit()
            session.refresh(search_log)
            
            return search_log
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error logging search operation: {e}")
            raise
    
    @staticmethod
    def create_worker_status(session, task_id, task_name):
        """Create a new worker status record"""
        try:
            worker_status = WorkerStatus(
                task_id=task_id,
                task_name=task_name,
                status='running'
            )
            
            session.add(worker_status)
            session.commit()
            session.refresh(worker_status)
            
            return worker_status
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error creating worker status: {e}")
            raise
    
    @staticmethod
    def log_email_notification(session, crm_owner, email_type, subject, matches_count=0, attachment_info=None, task_id=None):
        """Log an email notification"""
        try:
            notification = EmailNotification(
                crm_owner_id=crm_owner.get('id', 0),
                crm_owner_email=crm_owner.get('email', ''),
                email_type=email_type,
                subject=subject,
                matches_count=matches_count,
                attachment_filename=attachment_info.get('filename') if attachment_info else None,
                attachment_size_bytes=attachment_info.get('size') if attachment_info else None,
                task_id=task_id
            )
            
            session.add(notification)
            session.commit()
            session.refresh(notification)
            
            return notification
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error logging email notification: {e}")
            raise
    
    @staticmethod
    def get_unseen_property_ids(session, crm_owner_id):
        """Get property IDs that haven't been seen by this CRM owner"""
        try:
            seen_matches = session.query(PropertyMatch.property_id).filter(
                PropertyMatch.crm_owner_id == crm_owner_id,
                PropertyMatch.is_notified == True
            ).all()
            
            return [match.property_id for match in seen_matches]
            
        except Exception as e:
            logger.error(f"Error getting seen property IDs: {e}")
            return []
    
    @staticmethod
    def mark_matches_as_notified(session, match_ids):
        """Mark property matches as notified"""
        try:
            session.query(PropertyMatch).filter(
                PropertyMatch.id.in_(match_ids)
            ).update({
                PropertyMatch.is_notified: True,
                PropertyMatch.email_sent_at: func.now()
            }, synchronize_session=False)
            
            session.commit()
            logger.info(f"Marked {len(match_ids)} matches as notified")
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error marking matches as notified: {e}")
            raise

# Initialize database
if __name__ == "__main__":
    create_tables()
    print("Database tables created successfully!")
