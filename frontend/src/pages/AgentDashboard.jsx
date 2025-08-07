import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const AgentDashboard = () => {
  const [properties, setProperties] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  // Refs to prevent stale closure issues
  const refreshIntervalRef = useRef(null);
  const isInitializedRef = useRef(false);

  const { 
    user, 
    logout, 
    updateProfile, 
    fetchSeenProperties, 
    fetchDashboardStats,
    fetchUserData 
  } = useAuth();
  
  const navigate = useNavigate();

  // Memoized data loading functions to prevent unnecessary re-renders
  const loadProperties = useCallback(async () => {
    try {
      const data = await fetchSeenProperties();
      setProperties(data || []);
      return true;
    } catch (error) {
      console.error('Error fetching properties:', error);
      setError('Failed to load properties');
      return false;
    }
  }, [fetchSeenProperties]);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchDashboardStats();
      setStats(data || {});
      return true;
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load statistics');
      return false;
    }
  }, [fetchDashboardStats]);

  // Combined data loading function
  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    if (!user) return;

    // Don't show loading spinner for auto-refresh
    if (isManualRefresh || initialLoading) {
      setLoading(true);
    }
    
    setError('');

    try {
      // Ensure we have the latest user data
      await fetchUserData();

      // Load data in parallel
      await Promise.all([
        loadProperties(),
        loadStats()
      ]);

      // Initialize edit form only once
      if (!isInitializedRef.current) {
        setEditForm({
          name: user.name,
          email: user.email,
          token: user.token,
        });
        isInitializedRef.current = true;
      }

      setLastRefresh(new Date());

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data. Please try refreshing the page.');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [user, fetchUserData, loadProperties, loadStats, initialLoading]);

  // Initial load - only run once when user is available
  useEffect(() => {
    if (user && !isInitializedRef.current) {
      loadDashboardData();
    }
  }, [user]); // Only depend on user, not loadDashboardData

  // Auto-refresh timer - 15 minutes
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Only set up auto-refresh if user is logged in and initial load is complete
    if (user && !initialLoading) {
      refreshIntervalRef.current = setInterval(() => {
        console.log('Auto-refreshing dashboard data...');
        loadDashboardData(false); // false = not manual refresh (no loading spinner)
      }, 15 * 60 * 1000); // 15 minutes
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [user, initialLoading, loadDashboardData]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await updateProfile(editForm);
      
      if (result.success) {
        setEditMode(false);
        alert('Profile updated successfully!');
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear the refresh interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    logout();
    navigate('/login');
  };

  // Manual refresh function
  const handleManualRefresh = async () => {
    await loadDashboardData(true); // true = manual refresh (show loading spinner)
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysAgo = (property) => {
    // Use contract_date if available, otherwise fall back to created_at
    const dateToUse = property.contract_date || property.created_at;
    if (!dateToUse) return 0;
    
    const propertyDate = new Date(dateToUse);
    const now = new Date();
    const diffTime = now - propertyDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  const getDaysAgoLabel = (property) => {
    const daysAgo = getDaysAgo(property);
    const dateType = property.contract_date ? 'contract' : 'added';
    
    if (daysAgo === 0) {
      return dateType === 'contract' ? 'Contract today' : 'Added today';
    } else if (daysAgo === 1) {
      return dateType === 'contract' ? 'Contract 1 day ago' : 'Added 1 day ago';
    } else {
      return dateType === 'contract' ? `Contract ${daysAgo} days ago` : `Added ${daysAgo} days ago`;
    }
  };

  const getPropertyStatusColor = (property) => {
    const daysAgo = getDaysAgo(property);
    if (daysAgo === 0) return 'bg-blue-100 text-blue-800';
    if (daysAgo <= 7) return 'bg-green-100 text-green-800';
    if (daysAgo <= 30) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Show initial loading screen only on first load
  if (initialLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-large animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        .spinner-large {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #e74c3c;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .property-card {
          transition: all 0.3s ease;
        }
        
        .property-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        }
        
        .tab-button {
          padding: 12px 24px;
          border: none;
          background: transparent;
          color: #6c757d;
          border-bottom: 2px solid transparent;
          transition: all 0.3s ease;
        }
        
        .tab-button.active {
          color: #e74c3c;
          border-bottom-color: #e74c3c;
        }
        
        .stat-card {
          transition: all 0.3s ease;
        }
        
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }

        .refresh-indicator {
          opacity: 0.7;
          font-size: 0.75rem;
        }

        .auto-refresh-indicator {
          background: linear-gradient(45deg, #10b981, #059669);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Error Display and Last Refresh Info */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.name}!
              </h1>
              <p className="text-gray-600 mt-2">
                Company: {user?.companycode} | Email: {user?.email}
              </p>
              {lastRefresh && (
                <p className="text-sm text-gray-500 mt-1 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 auto-refresh-indicator"></span>
                  Last updated: {lastRefresh.toLocaleTimeString()} • Auto-refresh every 15 minutes
                </p>
              )}
              {error && (
                <div className="mt-3 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleManualRefresh}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg mb-8">
          <div className="flex border-b">
            <button
              className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`tab-button ${activeTab === 'properties' ? 'active' : ''}`}
              onClick={() => setActiveTab('properties')}
            >
              Seen Properties ({properties.length})
            </button>
            <button
              className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile Settings
            </button>
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="p-6">
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <div className="stat-card bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 text-center border-t-4 border-blue-600">
                  <div className="text-4xl text-blue-600 mb-4">🏠</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Total Properties</h3>
                  <p className="text-3xl font-bold text-blue-600">{stats.total_properties || 0}</p>
                  <p className="text-gray-600 mt-2">Properties viewed</p>
                </div>

                <div className="stat-card bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 text-center border-t-4 border-green-600">
                  <div className="text-4xl text-green-600 mb-4">📅</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Recent Activity</h3>
                  <p className="text-3xl font-bold text-green-600">{stats.recent_properties || 0}</p>
                  <p className="text-gray-600 mt-2">Added last 7 days</p>
                </div>

                <div className="stat-card bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 text-center border-t-4 border-purple-600">
                  <div className="text-4xl text-purple-600 mb-4">📋</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Recent Contracts</h3>
                  <p className="text-3xl font-bold text-purple-600">{stats.recent_contracts || 0}</p>
                  <p className="text-gray-600 mt-2">Contracts last 30 days</p>
                </div>

                <div className="stat-card bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 text-center border-t-4 border-red-600">
                  <div className="text-4xl text-red-600 mb-4">📍</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Active States</h3>
                  <p className="text-3xl font-bold text-red-600">{stats.state_breakdown?.length || 0}</p>
                  <p className="text-gray-600 mt-2">States covered</p>
                </div>
              </div>

              {/* State Breakdown */}
              {stats.state_breakdown && stats.state_breakdown.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Properties by State</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.state_breakdown.map((state, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-900">{state.state || 'Unknown'}</span>
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {state.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Properties Preview */}
              {properties.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-lg mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Recent Properties</h3>
                    <button
                      onClick={() => setActiveTab('properties')}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {properties.slice(0, 5).map((property) => (
                      <div key={property.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">
                            {property.street_address || 'Address not available'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {property.county}, {property.state}
                          </p>
                          <div className="text-xs text-gray-500 mt-1">
                            <div>Added: {formatDate(property.created_at)}</div>
                            {property.contract_date && (
                              <div>Contract: {formatDate(property.contract_date)}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPropertyStatusColor(property)}`}>
                            {getDaysAgoLabel(property)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Properties Tab */}
          {activeTab === 'properties' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  Your Seen Properties ({properties.length})
                </h3>
                <button
                  onClick={handleManualRefresh}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    'Refresh'
                  )}
                </button>
              </div>

              {properties.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl text-gray-300 mb-4">🏠</div>
                  <h4 className="text-xl font-medium text-gray-600 mb-2">No properties yet</h4>
                  <p className="text-gray-500">Your property matches will appear here when the system finds them.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {properties.map((property) => (
                    <div key={property.id} className="property-card bg-white rounded-lg p-6 shadow-md">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">
                            {property.street_address || 'Address not available'}
                          </h4>
                          <p className="text-gray-600">
                            {property.county}, {property.state}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                            ID: {property.property_id}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Owner Name</p>
                          <p className="font-medium">{property.owner_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Seller Name</p>
                          <p className="font-medium">{property.seller_name || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Date Information Section */}
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Added to System</p>
                            <p className="font-medium">{formatDate(property.created_at)}</p>
                            <p className="text-xs text-green-600">
                              {getDaysAgo({created_at: property.created_at})} days ago
                            </p>
                          </div>
                          {property.contract_date && (
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm text-blue-600 mb-1">Contract Date</p>
                              <p className="font-medium">{formatDate(property.contract_date)}</p>
                              <p className="text-xs text-blue-600">
                                {getDaysAgo({contract_date: property.contract_date})} days ago
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {(property.contact_email || property.contact_first_name) && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-2">Contact Information</p>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <p className="font-medium">
                                {[property.contact_first_name, property.contact_middle_name, property.contact_last_name]
                                  .filter(Boolean)
                                  .join(' ') || 'N/A'}
                              </p>
                              {property.contact_email && (
                                <p className="text-sm text-blue-600">{property.contact_email}</p>
                              )}
                            </div>
                            {property.name_variation && (
                              <div>
                                <p className="text-sm text-gray-600">Name Variation</p>
                                <p className="font-medium">{property.name_variation}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPropertyStatusColor(property)}`}>
                          {getDaysAgoLabel(property)}
                        </span>
                        <div className="text-xs text-gray-500">
                          Priority: {property.contract_date ? 'Contract Date' : 'System Date'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="p-6">
              <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Profile Settings</h3>
                  <button
                    onClick={() => {
                      setEditMode(!editMode);
                      if (!editMode) {
                        setEditForm({
                          name: user.name,
                          email: user.email,
                          token: user.token,
                        });
                      }
                    }}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      editMode 
                        ? 'bg-gray-600 text-white hover:bg-gray-700' 
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {editMode ? 'Cancel' : 'Edit Profile'}
                  </button>
                </div>

                {editMode ? (
                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div>
                      <label className="block text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-2">CRM Token</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                        value={editForm.token || ''}
                        onChange={(e) => setEditForm({...editForm, token: e.target.value})}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="flex space-x-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditMode(false)}
                        disabled={loading}
                        className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-6 rounded-xl">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h4>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Name</p>
                          <p className="text-lg font-medium text-gray-900">{user?.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Email</p>
                          <p className="text-lg font-medium text-gray-900">{user?.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Company Code</p>
                          <p className="text-lg font-medium text-gray-900">{user?.companycode}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">CRM Token</p>
                          <p className="text-lg font-medium text-gray-900 font-mono">
                            {user?.token?.substring(0, 20)}...
                          </p>
                        </div>
                      </div>
                    </div>

                    {user?.states_counties && user.states_counties.length > 0 && (
                      <div className="bg-gray-50 p-6 rounded-xl">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Assigned States & Counties</h4>
                        <div className="space-y-4">
                          {user.states_counties.map((state, index) => (
                            <div key={index} className="bg-white p-4 rounded-lg">
                              <h5 className="font-semibold text-gray-900 mb-2">
                                {state.state_name} ({state.counties?.length || 0} counties)
                              </h5>
                              <div className="flex flex-wrap gap-2">
                                {state.counties?.slice(0, 5).map((county, idx) => (
                                  <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                    {county.county_name}
                                  </span>
                                ))}
                                {state.counties?.length > 5 && (
                                  <span className="text-gray-500 text-sm">
                                    +{state.counties.length - 5} more
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Session Information */}
                    <div className="bg-gray-50 p-6 rounded-xl">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Session Information</h4>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">User ID</p>
                          <p className="text-lg font-medium text-gray-900">{user?.id}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Auto-Refresh Status</p>
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 auto-refresh-indicator"></span>
                            <p className="text-lg font-medium text-gray-900">Active (15 min)</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Last Update</p>
                          <p className="text-lg font-medium text-gray-900">
                            {lastRefresh ? lastRefresh.toLocaleString() : 'Loading...'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Session Time</p>
                          <p className="text-lg font-medium text-gray-900">
                            {new Date().toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;
