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
  const [sessionStartTime, setSessionStartTime] = useState(null);

  // Enhanced profile editing state
  const [statesData, setStatesData] = useState([]);
  const [counties, setCounties] = useState([]);
  const [selectedSelections, setSelectedSelections] = useState([]);
  const [tempFormState, setTempFormState] = useState({
    state: '',
    county: ''
  });
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  // Refs to prevent stale closure issues
  const refreshIntervalRef = useRef(null);
  const isInitializedRef = useRef(false);

  const { 
    user, 
    logout, 
    updateProfile, 
    fetchSeenProperties, 
    fetchDashboardStats,
    fetchUserData,
    API_URL
  } = useAuth();
  
  const navigate = useNavigate();

  // Enhanced data loading functions
  const loadStatesData = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/states_counties`);
      const data = await response.json();
      setStatesData(data);
    } catch (error) {
      console.error('Error loading states:', error);
    }
  }, [API_URL]);

  const handleStateChange = (e) => {
    const stateFIPS = parseInt(e.target.value, 10);
    const selectedState = statesData.find(s => s.state_FIPS === stateFIPS);
    setCounties(selectedState?.counties || []);
    setTempFormState(prev => ({
      ...prev,
      state: stateFIPS,
      county: ''
    }));
  };

  const addStateCountySelection = () => {
    if (!tempFormState.state || !tempFormState.county) {
      alert("Please select both state and county");
      return;
    }

    const state = statesData.find(s => s.state_FIPS === tempFormState.state);
    const county = counties.find(c => c.county_FIPS === tempFormState.county);

    const newSelection = {
      state_FIPS: tempFormState.state,
      state_name: state.state_name,
      counties: [{
        county_FIPS: tempFormState.county,
        county_name: county.county_name
      }]
    };

    // Check if state already exists in selections
    const existingStateIndex = selectedSelections.findIndex(
      s => s.state_FIPS === tempFormState.state
    );

    if (existingStateIndex !== -1) {
      // Add county to existing state
      const updatedSelections = [...selectedSelections];
      const existingCounty = updatedSelections[existingStateIndex].counties.find(
        c => c.county_FIPS === tempFormState.county
      );
      
      if (!existingCounty) {
        updatedSelections[existingStateIndex].counties.push({
          county_FIPS: tempFormState.county,
          county_name: county.county_name
        });
        setSelectedSelections(updatedSelections);
      } else {
        alert("This county is already selected");
      }
    } else {
      // Add new state with county
      setSelectedSelections(prev => [...prev, newSelection]);
    }

    setTempFormState({ state: '', county: '' });
    setCounties([]);
  };

  const removeStateCounty = (stateIndex, countyIndex) => {
    const updatedSelections = [...selectedSelections];
    updatedSelections[stateIndex].counties.splice(countyIndex, 1);
    
    // Remove state if no counties left
    if (updatedSelections[stateIndex].counties.length === 0) {
      updatedSelections.splice(stateIndex, 1);
    }
    
    setSelectedSelections(updatedSelections);
  };

  // Memoized data loading functions
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

    if (isManualRefresh || initialLoading) {
      setLoading(true);
    }
    
    setError('');

    try {
      await fetchUserData();

      await Promise.all([
        loadProperties(),
        loadStats()
      ]);

      if (!isInitializedRef.current) {
        setEditForm({
          name: user.name,
          email: user.email,
          token: user.token,
          companycode: user.companycode,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
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
  


  useEffect(() => {
    if (user && !isInitializedRef.current) {
      // Initialize session time from localStorage or create new one
      const savedSessionStart = localStorage.getItem('sessionStartTime');
      if (savedSessionStart) {
        setSessionStartTime(new Date(savedSessionStart));
      } else {
        const newSessionTime = new Date();
        setSessionStartTime(newSessionTime);
        localStorage.setItem('sessionStartTime', newSessionTime.toISOString());
      }
      loadDashboardData();
    }
  }, [user]);
  // Initialize when edit mode is activated
  useEffect(() => {
    if (editMode) {
      loadStatesData();
      
      if (user?.states_counties) {
        setSelectedSelections(user.states_counties);
      }
      
      setEditForm({
        name: user.name,
        email: user.email,
        token: user.token,
        companycode: user.companycode,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  }, [editMode, user, loadStatesData]);

  // Initial load
  useEffect(() => {
    if (user && !isInitializedRef.current) {
      loadDashboardData();
    }
  }, [user]);

  // Auto-refresh timer
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    if (user && !initialLoading) {
      refreshIntervalRef.current = setInterval(() => {
        loadDashboardData(false);
      }, 15 * 60 * 1000);
    }

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
      // Validation
      if (!editForm.name || !editForm.email || !editForm.token || !editForm.companycode) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      if (selectedSelections.length === 0) {
        setError('Please select at least one state and county');
        setLoading(false);
        return;
      }

      // Password validation if changing password
      if (showPasswordFields) {
        if (!editForm.currentPassword || !editForm.newPassword || !editForm.confirmPassword) {
          setError('Please fill in all password fields');
          setLoading(false);
          return;
        }

        if (editForm.newPassword !== editForm.confirmPassword) {
          setError('New passwords do not match');
          setLoading(false);
          return;
        }

        if (editForm.newPassword.length < 6) {
          setError('New password must be at least 6 characters');
          setLoading(false);
          return;
        }
      }

      // Prepare update data
      const updateData = {
        name: editForm.name,
        email: editForm.email,
        token: editForm.token,
        companycode: editForm.companycode,
        states_counties: selectedSelections
      };

      if (showPasswordFields) {
        updateData.current_password = editForm.currentPassword;
        updateData.new_password = editForm.newPassword;
      }

      const result = await updateProfile(updateData);
      
      if (result.success) {
        setEditMode(false);
        setShowPasswordFields(false);
        
        setEditForm(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
        
        alert('Profile updated successfully!');
        await loadDashboardData(false);
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    localStorage.removeItem('sessionStartTime'); // Clear session time
    logout();
    navigate('/agent-login');
  };

  const handleManualRefresh = async () => {
    await loadDashboardData(true);
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
  
  // Format time as relative (e.g. "2 minutes ago")
  const formatRelativeTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };
  
  // Format session duration
  const formatSessionDuration = (startTime) => {
    if (!startTime) return 'New session';
    
    const now = new Date();
    const diff = now - new Date(startTime);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
  
    if (seconds < 60) return 'Just started';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const getDaysAgo = (property) => {
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
        {/* Header */}
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
                  Last updated: {lastRefresh.toLocaleTimeString()}
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
                  <p className="text-gray-600 mt-2">Properties tracked</p>
                </div>

                <div className="stat-card bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 text-center border-t-4 border-green-600">
                  <div className="text-4xl text-green-600 mb-4">📅</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Recent Activity</h3>
                  <p className="text-3xl font-bold text-green-600">{stats.recent_properties || 0}</p>
                  <p className="text-gray-600 mt-2">Last 7 days</p>
                </div>

                <div className="stat-card bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 text-center border-t-4 border-purple-600">
                  <div className="text-4xl text-purple-600 mb-4">📋</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Recent Contracts</h3>
                  <p className="text-3xl font-bold text-purple-600">{stats.recent_contracts || 0}</p>
                  <p className="text-gray-600 mt-2">Last 30 days</p>
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
                            <div>{formatDate(property.created_at)}</div>
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
                  Your Properties ({properties.length})
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
                  <p className="text-gray-500">Your property matches will appear here when found.</p>
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

                      {/* Date Information */}
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">System Date</p>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enhanced Profile Tab */}
          {activeTab === 'profile' && (
            <div className="p-6">
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Profile Settings</h3>
                  <button
                    onClick={() => {
                      setEditMode(!editMode);
                      setShowPasswordFields(false);
                      if (!editMode) {
                        setEditForm({
                          name: user.name,
                          email: user.email,
                          token: user.token,
                          companycode: user.companycode,
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        });
                        setSelectedSelections(user.states_counties || []);
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
                    {/* Personal Information Section */}
                    <div className="bg-gray-50 p-6 rounded-xl">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h4>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">Name *</label>
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
                          <label className="block text-gray-700 mb-2 font-medium">Email *</label>
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
                          <label className="block text-gray-700 mb-2 font-medium">CRM Token *</label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                            value={editForm.token || ''}
                            onChange={(e) => setEditForm({...editForm, token: e.target.value})}
                            required
                            disabled={loading}
                          />
                        </div>
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">Company Code *</label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                            value={editForm.companycode || ''}
                            onChange={(e) => setEditForm({...editForm, companycode: e.target.value})}
                            placeholder="Enter your company code"
                            required
                            disabled={loading}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Contact your company administrator for your company code
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Password Section */}
                    <div className="bg-gray-50 p-6 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-900">Password Settings</h4>
                        <button
                          type="button"
                          onClick={() => setShowPasswordFields(!showPasswordFields)}
                          className="text-red-600 hover:text-red-700 font-medium"
                        >
                          {showPasswordFields ? 'Cancel Password Change' : 'Change Password'}
                        </button>
                      </div>
                      
                      {showPasswordFields && (
                        <div className="grid md:grid-cols-1 gap-6">
                          <div>
                            <label className="block text-gray-700 mb-2 font-medium">Current Password *</label>
                            <input
                              type="password"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                              value={editForm.currentPassword || ''}
                              onChange={(e) => setEditForm({...editForm, currentPassword: e.target.value})}
                              disabled={loading}
                            />
                          </div>
                          <div className="grid md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-gray-700 mb-2 font-medium">New Password *</label>
                              <input
                                type="password"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                                value={editForm.newPassword || ''}
                                onChange={(e) => setEditForm({...editForm, newPassword: e.target.value})}
                                disabled={loading}
                                minLength="6"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-700 mb-2 font-medium">Confirm New Password *</label>
                              <input
                                type="password"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                                value={editForm.confirmPassword || ''}
                                onChange={(e) => setEditForm({...editForm, confirmPassword: e.target.value})}
                                disabled={loading}
                                minLength="6"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Service Areas Section */}
                    <div className="bg-gray-50 p-6 rounded-xl">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Service Areas *</h4>
                      
                      {/* Add New State/County */}
                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">State</label>
                          <select
                            value={tempFormState.state}
                            onChange={handleStateChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                            disabled={loading}
                          >
                            <option value="">Select State</option>
                            {statesData.map(state => (
                              <option key={state.state_FIPS} value={state.state_FIPS}>
                                {state.state_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">County</label>
                          <select
                            value={tempFormState.county}
                            onChange={(e) => setTempFormState(prev => ({...prev, county: parseInt(e.target.value, 10)}))}
                            disabled={!tempFormState.state || loading}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                          >
                            <option value="">Select County</option>
                            {counties.map(county => (
                              <option key={county.county_FIPS} value={county.county_FIPS}>
                                {county.county_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={addStateCountySelection}
                            disabled={!tempFormState.state || !tempFormState.county || loading}
                            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            Add Area
                          </button>
                        </div>
                      </div>

                      {/* Selected Areas Display */}
                      {selectedSelections.length > 0 && (
                        <div className="space-y-4">
                          <h5 className="font-medium text-gray-900">Selected Service Areas:</h5>
                          {selectedSelections.map((state, stateIndex) => (
                            <div key={state.state_FIPS} className="bg-white p-4 rounded-lg border">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-semibold text-gray-900">
                                  {state.state_name} ({state.counties?.length || 0} counties)
                                </h6>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {state.counties?.map((county, countyIndex) => (
                                  <div
                                    key={county.county_FIPS}
                                    className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded text-sm"
                                  >
                                    <span>{county.county_name}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeStateCounty(stateIndex, countyIndex)}
                                      className="text-red-600 hover:text-red-800 ml-2"
                                      disabled={loading}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-4 pt-4">
                      <button
                        type="submit"
                        disabled={loading || selectedSelections.length === 0}
                        className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditMode(false);
                          setShowPasswordFields(false);
                        }}
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
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {state.counties?.map((county, idx) => (
                                  <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm">
                                    {county.county_name}
                                  </span>
                                ))}
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
                          <p className="text-sm text-gray-600 mb-1">Account</p>
                          <p className="text-lg font-medium text-gray-900">
                            {user?.email || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Auto-Refresh</p>
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 auto-refresh-indicator"></span>
                            <p className="text-lg font-medium text-gray-900">Every 15 min</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Last Updated</p>
                          <p className="text-lg font-medium text-gray-900">
                            {lastRefresh ? formatRelativeTime(lastRefresh) : 'Never'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Session Duration</p>
                          <p className="text-lg font-medium text-gray-900">
                            {sessionStartTime ? formatSessionDuration(sessionStartTime) : 'New session'}
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
