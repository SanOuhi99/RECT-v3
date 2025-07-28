# worker/database/service.py
import logging
from contextlib import contextmanager
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from .models import (
    get_db_session, 
    DatabaseManager, 
    PropertyMatch, 
    SearchLog, 
    WorkerStatus,
    EmailNotification
)
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class WorkerDatabaseService:
    """Service class for all worker database operations"""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
    
    @contextmanager
    def get_session(self):
        """Context manager for database sessions with automatic cleanup"""
        session = get_db_session()
        try:
            yield session
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            session.close()
    
    def save_property_matches_batch(self, matches_data: List[Dict], crm_owner: Dict, task_id: str = None) -> List[PropertyMatch]:
        """Save multiple property matches in a single transaction"""
        saved_matches = []
        
        with self.get_session() as session:
            try:
                for match_data in matches_data:
                    # Check if this property match already exists
                    existing_match = session.query(PropertyMatch).filter(
                        PropertyMatch.property_id == match_data.get('Property ID'),
                        PropertyMatch.crm_owner_id == crm_owner.get('id', 0),
                        PropertyMatch.contact_email == match_data.get('Contact Email', '')
                    ).first()
                    
                    if existing_match:
                        logger.debug(f"Property match already exists: {match_data.get('Property ID')}")
                        continue
                    
                    # Create new property match
                    property_match = PropertyMatch(
                        property_id=match_data.get('Property ID', ''),
                        owner_name=match_data.get('Owner Name', ''),
                        street_address=match_data.get('Street Address', ''),
                        county=match_data.get('County', ''),
                        state=match_data.get('State', ''),
                        seller_name=match_data.get('Seller Name', ''),
                        sale_date=self._parse_date(match_data.get('Sale Date')),
                        sale_price=self._parse_float(match_data.get('Sale Price')),
                        
                        crm_owner_id=crm_owner.get('id', 0),
                        crm_owner_name=crm_owner.get('Name', ''),
                        crm_owner_email=crm_owner.get('email', ''),
                        contact_name=match_data.get('Contact Name', ''),
                        contact_email=match_data.get('Contact Email', ''),
                        
                        match_confidence=match_data.get('Match Confidence', 0.0),
                        name_variation_used=match_data.get('Name Variation Used'),
                        search_criteria=match_data.get('Search Criteria'),
                        
                        is_new_match=True,
                        is_notified=False
                    )
                    
                    session.add(property_match)
                    saved_matches.append(property_match)
                
                session.commit()
                
                # Refresh all objects to get IDs
                for match in saved_matches:
                    session.refresh(match)
                
                logger.info(f"Saved {len(saved_matches)} new property matches for {crm_owner.get('Name')}")
                return saved_matches
                
            except SQLAlchemyError as e:
                session.rollback()
                logger.error(f"Database error saving property matches: {e}")
                raise
    
    def get_crm_owner_by_email(self, email: str) -> Optional[Dict]:
        """Get CRM owner from the existing crm_owners table"""
        with self.get_session() as session:
            try:
                # Query the existing crm_owners table
                result = session.execute(
                    "SELECT id, name, email, token, companycode, seen_property_ids, states_counties "
                    "FROM crm_owners WHERE email = :email",
                    {'email': email}
                ).fetchone()
                
                if result:
                    return {
                        'id': result.id,
                        'Name': result.name,
                        'email': result.email,
                        'token': result.token,
                        'companycode': result.companycode,
                        'seen_property_ids': set(result.seen_property_ids or []),
                        'states_counties': result.states_counties or []
                    }
                return None
                
            except Exception as e:
                logger.error(f"Error fetching CRM owner by email {email}: {e}")
                return None
    
    def get_all_crm_owners(self) -> List[Dict]:
        """Get all CRM owners from the database"""
        with self.get_session() as session:
            try:
                results = session.execute(
                    "SELECT id, name, email, token, companycode, seen_property_ids, states_counties "
                    "FROM crm_owners"
                ).fetchall()
                
                crm_owners = []
                for result in results:
                    crm_owners.append({
                        'id': result.id,
                        'Name': result.name,
                        'email': result.email,
                        'token': result.token,
                        'companycode': result.companycode,
                        'seen_property_ids': set(result.seen_property_ids or []),
                        'states_counties': result.states_counties or []
                    })
                
                logger.info(f"Retrieved {len(crm_owners)} CRM owners from database")
                return crm_owners
                
            except Exception as e:
                logger.error(f"Error fetching all CRM owners: {e}")
                return []
    
    def update_crm_owner_seen_properties(self, crm_owner_id: int, new_property_ids: List[str]):
        """Update the seen_property_ids for a CRM owner"""
        with self.get_session() as session:
            try:
                # Get current seen property IDs
                result = session.execute(
                    "SELECT seen_property_ids FROM crm_owners WHERE id = :id",
                    {'id': crm_owner_id}
                ).fetchone()
                
                if result:
                    current_ids = set(result.seen_property_ids or [])
                    updated_ids = current_ids.union(set(new_property_ids))
                    
                    # Update the database
                    session.execute(
                        "UPDATE crm_owners SET seen_property_ids = :ids WHERE id = :id",
                        {'ids': list(updated_ids), 'id': crm_owner_id}
                    )
                    session.commit()
                    
                    logger.info(f"Updated seen property IDs for CRM owner {crm_owner_id}: added {len(new_property_ids)} new IDs")
                
            except Exception as e:
                session.rollback()
                logger.error(f"Error updating seen property IDs for CRM owner {crm_owner_id}: {e}")
                raise
    
    def create_worker_task_status(self, task_id: str, task_name: str) -> WorkerStatus:
        """Create a new worker task status record"""
        with self.get_session() as session:
            try:
                worker_status = WorkerStatus(
                    task_id=task_id,
                    task_name=task_name,
                    status='running'
                )
                
                session.add(worker_status)
                session.commit()
                session.refresh(worker_status)
                
                logger.info(f"Created worker status record for task {task_id}")
                return worker_status
                
            except Exception as e:
                session.rollback()
                logger.error(f"Error creating worker status: {e}")
                raise
    
    def update_worker_task_progress(self, task_id: str, **progress_data):
        """Update worker task progress"""
        with self.get_session() as session:
            try:
                worker_status = session.query(WorkerStatus).filter(
                    WorkerStatus.task_id == task_id
                ).first()
                
                if worker_status:
                    for key, value in progress_data.items():
                        if hasattr(worker_status, key):
                            setattr(worker_status, key, value)
                    
                    session.commit()
                    logger.debug(f"Updated progress for task {task_id}: {progress_data}")
                
            except Exception as e:
                session.rollback()
                logger.error(f"Error updating worker task progress: {e}")
                raise
    
    def complete_worker_task(self, task_id: str, status: str = 'completed', 
                           error_message: str = None, performance_metrics: Dict = None):
        """Mark worker task as completed"""
        with self.get_session() as session:
            try:
                worker_status = session.query(WorkerStatus).filter(
                    WorkerStatus.task_id == task_id
                ).first()
                
                if worker_status:
                    worker_status.completed_at = datetime.now()
                    worker_status.status = status
                    if error_message:
                        worker_status.error_message = error_message
                    if performance_metrics:
                        worker_status.performance_metrics = performance_metrics
                    
                    session.commit()
                    logger.info(f"Completed worker task {task_id} with status: {status}")
                
            except Exception as e:
                session.rollback()
                logger.error(f"Error completing worker task: {e}")
                raise
    
    def log_search_operation(self, crm_owner: Dict, search_type: str, search_params: Dict, 
                           results_count: int = 0, success: bool = True, error_message: str = None) -> SearchLog:
        """Log a search operation"""
        with self.get_session() as session:
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
    
    def log_email_notification(self, crm_owner: Dict, email_type: str, subject: str, 
                             matches_count: int = 0, attachment_info: Dict = None, 
                             task_id: str = None, property_match_ids: List[int] = None) -> EmailNotification:
        """Log an email notification"""
        with self.get_session() as session:
            try:
                notification = EmailNotification(
                    crm_owner_id=crm_owner.get('id', 0),
                    crm_owner_email=crm_owner.get('email', ''),
                    email_type=email_type,
                    subject=subject,
                    matches_count=matches_count,
                    attachment_filename=attachment_info.get('filename') if attachment_info else None,
                    attachment_size_bytes=attachment_info.get('size') if attachment_info else None,
                    task_id=task_id,
                    property_match_ids=property_match_ids or []
                )
                
                session.add(notification)
                session.commit()
                session.refresh(notification)
                
                logger.info(f"Logged email notification for {crm_owner.get('email')}")
                return notification
                
            except Exception as e:
                session.rollback()
                logger.error(f"Error logging email notification: {e}")
                raise
    
    def get_recent_matches_for_owner(self, crm_owner_id: int, days: int = 30) -> List[PropertyMatch]:
        """Get recent property matches for a CRM owner"""
        with self.get_session() as session:
            try:
                since_date = datetime.now() - timedelta(days=days)
                
                matches = session.query(PropertyMatch).filter(
                    PropertyMatch.crm_owner_id == crm_owner_id,
                    PropertyMatch.created_at >= since_date
                ).order_by(PropertyMatch.created_at.desc()).all()
                
                return matches
                
            except Exception as e:
                logger.error(f"Error getting recent matches for owner {crm_owner_id}: {e}")
                return []
    
    def get_search_statistics(self, crm_owner_id: int = None, days: int = 30) -> Dict[str, Any]:
        """Get search statistics for monitoring"""
        with self.get_session() as session:
            try:
                since_date = datetime.now() - timedelta(days=days)
                
                # Base query
                query = session.query(SearchLog).filter(SearchLog.started_at >= since_date)
                
                if crm_owner_id:
                    query = query.filter(SearchLog.crm_owner_id == crm_owner_id)
                
                searches = query.all()
                
                total_searches = len(searches)
                successful_searches = len([s for s in searches if s.success])
                total_results = sum(s.results_count for s in searches)
                total_api_calls = sum(s.api_calls_made for s in searches)
                
                return {
                    'total_searches': total_searches,
                    'successful_searches': successful_searches,
                    'success_rate': (successful_searches / total_searches * 100) if total_searches > 0 else 0,
                    'total_results_found': total_results,
                    'total_api_calls_made': total_api_calls,
                    'average_results_per_search': (total_results / total_searches) if total_searches > 0 else 0
                }
                
            except Exception as e:
                logger.error(f"Error getting search statistics: {e}")
                return {}
    
    def cleanup_old_data(self, days: int = 90):
        """Clean up old log data to prevent database bloat"""
        with self.get_session() as session:
            try:
                cutoff_date = datetime.now() - timedelta(days=days)
                
                # Clean up old search logs
                deleted_logs = session.query(SearchLog).filter(
                    SearchLog.started_at < cutoff_date
                ).delete()
                
                # Clean up old worker status records (keep completed/failed ones longer)
                deleted_status = session.query(WorkerStatus).filter(
                    WorkerStatus.started_at < cutoff_date,
                    WorkerStatus.status.in_(['completed', 'cancelled'])
                ).delete()
                
                session.commit()
                
                logger.info(f"Cleaned up {deleted_logs} old search logs and {deleted_status} old worker status records")
                
            except Exception as e:
                session.rollback()
                logger.error(f"Error cleaning up old data: {e}")
                raise
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string to datetime object"""
        if not date_str:
            return None
        
        try:
            # Handle various date formats
            for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S']:
                try:
                    return datetime.strptime(str(date_str), fmt)
                except ValueError:
                    continue
            return None
        except Exception:
            return None
    
    def _parse_float(self, value) -> Optional[float]:
        """Parse float value safely"""
        if not value:
            return None
        
        try:
            # Remove common currency symbols and commas
            if isinstance(value, str):
                value = value.replace(', '').replace(',', '').strip()
            return float(value)
        except (ValueError, TypeError):
            return None
