import time
import threading
import queue
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from contextlib import contextmanager

logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetrics:
    """Track performance metrics for monitoring"""
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    duration: Optional[float] = None
    total_contacts_processed: int = 0
    total_properties_found: int = 0
    total_api_calls: int = 0
    failed_api_calls: int = 0
    crm_owner_metrics: Dict[str, Dict] = field(default_factory=dict)
    
    def finish(self):
        """Mark metrics as complete"""
        self.end_time = time.time()
        self.duration = self.end_time - self.start_time
    
    def add_crm_owner_metric(self, owner_name: str, contacts: int, properties: int, api_calls: int):
        """Add metrics for a specific CRM owner"""
        self.crm_owner_metrics[owner_name] = {
            'contacts_processed': contacts,
            'properties_found': properties,
            'api_calls_made': api_calls,
            'timestamp': datetime.now().isoformat()
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary for logging/storage"""
        return {
            'start_time': datetime.fromtimestamp(self.start_time).isoformat(),
            'end_time': datetime.fromtimestamp(self.end_time).isoformat() if self.end_time else None,
            'duration_seconds': self.duration,
            'total_contacts_processed': self.total_contacts_processed,
            'total_properties_found': self.total_properties_found,
            'total_api_calls': self.total_api_calls,
            'failed_api_calls': self.failed_api_calls,
            'success_rate': ((self.total_api_calls - self.failed_api_calls) / self.total_api_calls * 100) if self.total_api_calls > 0 else 0,
            'crm_owner_metrics': self.crm_owner_metrics
        }

class ProcessingQueue:
    """Enhanced queue with progress tracking"""
    def __init__(self, max_size: int = 1000):
        self.queue = queue.Queue(maxsize=max_size)
        self.total_items = 0
        self.processed_items = 0
        self.failed_items = 0
        self._lock = threading.Lock()
    
    def add_item(self, item):
        """Add item to queue"""
        self.queue.put(item)
        with self._lock:
            self.total_items += 1
    
    def get_item(self):
        """Get item from queue"""
        return self.queue.get()
    
    def mark_processed(self, success: bool = True):
        """Mark item as processed"""
        with self._lock:
            self.processed_items += 1
            if not success:
                self.failed_items += 1
    
    def get_progress(self) -> Dict[str, Any]:
        """Get current progress statistics"""
        with self._lock:
            return {
                'total': self.total_items,
                'processed': self.processed_items,
                'failed': self.failed_items,
                'remaining': self.total_items - self.processed_items,
                'success_rate': ((self.processed_items - self.failed_items) / self.processed_items * 100) if self.processed_items > 0 else 0
            }

class AdaptiveThreadManager:
    """Dynamically adjust thread count based on performance"""
    def __init__(self, initial_threads: int = 5, min_threads: int = 2, max_threads: int = 20):
        self.current_threads = initial_threads
        self.min_threads = min_threads
        self.max_threads = max_threads
        self.performance_history = []
        self.adjustment_cooldown = 60  # seconds between adjustments
        self.last_adjustment = 0
    
    def record_performance(self, duration: float, success: bool):
        """Record performance data point"""
        self.performance_history.append({
            'duration': duration,
            'success': success,
            'timestamp': time.time(),
            'thread_count': self.current_threads
        })
        
        # Keep only recent history (last 100 operations)
        if len(self.performance_history) > 100:
            self.performance_history = self.performance_history[-100:]
    
    def should_adjust_threads(self) -> Optional[int]:
        """Determine if thread count should be adjusted"""
        if time.time() - self.last_adjustment < self.adjustment_cooldown:
            return None
        
        if len(self.performance_history) < 10:
            return None
        
        recent_performance = self.performance_history[-10:]
        avg_duration = sum(p['duration'] for p in recent_performance) / len(recent_performance)
        success_rate = sum(1 for p in recent_performance if p['success']) / len(recent_performance)
        
        # Increase threads if performance is good and success rate is high
        if avg_duration < 2.0 and success_rate > 0.9 and self.current_threads < self.max_threads:
            new_count = min(self.current_threads + 2, self.max_threads)
            logger.info(f"Increasing thread count from {self.current_threads} to {new_count}")
            self.current_threads = new_count
            self.last_adjustment = time.time()
            return new_count
        
        # Decrease threads if performance is poor or success rate is low
        elif (avg_duration > 10.0 or success_rate < 0.7) and self.current_threads > self.min_threads:
            new_count = max(self.current_threads - 1, self.min_threads)
            logger.info(f"Decreasing thread count from {self.current_threads} to {new_count}")
            self.current_threads = new_count
            self.last_adjustment = time.time()
            return new_count
        
        return None

@contextmanager
def performance_timer():
    """Context manager for timing operations"""
    start_time = time.time()
    try:
        yield start_time
    finally:
        duration = time.time() - start_time
        logger.debug(f"Operation completed in {duration:.2f} seconds")

class EnhancedPropertySearchManager:
    """Enhanced search manager with performance optimization"""
    
    def __init__(self, config_manager, max_workers: int = 5):
        self.config_manager = config_manager
        self.thread_manager = AdaptiveThreadManager(initial_threads=max_workers)
        self.metrics = PerformanceMetrics()
        self.processing_queue = ProcessingQueue()
    
    def process_all_crm_owners(self, crm_owners: List[Dict[str, Any]]):
        """Process all CRM owners with enhanced monitoring"""
        logger.info(f"Starting property search for {len(crm_owners)} CRM owners")
        
        with ThreadPoolExecutor(max_workers=self.thread_manager.current_threads) as executor:
            # Submit all CRM owner processing tasks
            future_to_owner = {
                executor.submit(self._process_crm_owner_with_metrics, owner): owner 
                for owner in crm_owners
            }
            
            # Process completed tasks
            for future in as_completed(future_to_owner):
                owner = future_to_owner[future]
                try:
                    owner_metrics = future.result()
                    if owner_metrics:
                        self.metrics.add_crm_owner_metric(
                            owner['Name'], 
                            owner_metrics['contacts'],
                            owner_metrics['properties'],
                            owner_metrics['api_calls']
                        )
                        logger.info(f"Completed processing for {owner['Name']}: {owner_metrics}")
                    
                    # Check if we should adjust thread count
                    new_thread_count = self.thread_manager.should_adjust_threads()
                    if new_thread_count:
                        # Note: ThreadPoolExecutor doesn't support dynamic resizing
                        # This would be used for future batches
                        pass
                        
                except Exception as e:
                    logger.error(f"Error processing CRM owner {owner['Name']}: {e}")
                    self.metrics.failed_api_calls += 1
        
        self.metrics.finish()
        self._log_final_metrics()
    
    def _process_crm_owner_with_metrics(self, crm_owner: Dict[str, Any]) -> Dict[str, int]:
        """Process a single CRM owner with detailed metrics"""
        with performance_timer():
            start_time = time.time()
            contacts_processed = 0
            properties_found = 0
            api_calls_made = 0
            
            try:
                # Fetch contacts
                contacts = self._fetch_contacts_with_retry(crm_owner['token'])
                
                if not contacts:
                    logger.warning(f"No contacts found for {crm_owner['Name']}")
                    return {'contacts': 0, 'properties': 0, 'api_calls': 1}
                
                api_calls_made += 1
                
                # Process contacts with thread pooling
                contact_results = []
                states_counties = crm_owner.get("states_counties", [])
                
                # Batch contacts for better performance
                batch_size = 50
                contact_batches = [contacts[i:i + batch_size] for i in range(0, len(contacts), batch_size)]
                
                for batch in contact_batches:
                    with ThreadPoolExecutor(max_workers=min(10, len(batch))) as contact_executor:
                        contact_futures = {
                            contact_executor.submit(
                                self._search_contact_properties, 
                                contact, 
                                crm_owner, 
                                states_counties
                            ): contact 
                            for contact in batch 
                            if self._validate_contact(contact)
                        }
                        
                        for contact_future in as_completed(contact_futures):
                            contact = contact_futures[contact_future]
                            try:
                                result = contact_future.result()
                                if result:
                                    contact_results.extend(result)
                                    properties_found += len(result)
                                contacts_processed += 1
                                api_calls_made += result.get('api_calls', 0) if isinstance(result, dict) else 2
                            except Exception as e:
                                logger.error(f"Error processing contact {contact.get('name', 'Unknown')}: {e}")
                
                # Save results if any properties found
                if contact_results:
                    self._save_results(contact_results, crm_owner)
                
                # Update seen properties
                self._update_seen_properties(crm_owner)
                
                duration = time.time() - start_time
                self.thread_manager.record_performance
