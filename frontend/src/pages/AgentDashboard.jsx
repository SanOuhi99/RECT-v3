// frontend/src/pages/AgentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const AgentDashboard = () => {
  const [properties, setProperties] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');

  const { 
    user, 
    logout, 
    updateProfile, 
    fetchSeenProperties, 
    fetchDashboardStats,
    fetchUserData 
  } = useAuth();
  
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      initializeDashboard();
    }
  }, [user]);

  const initializeDashboard = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch user data to ensure we have the latest info
      await fetchUserData();

      // Fetch properties and stats in parallel
      await Promise.all([
        loadProperties(),
        loadStats()
      ]);

      // Initialize edit form
      setEditForm({
        name: user.name,
        email: user.email,
        token: user.token,
      });

    } catch (error) {
      console.error('Error initializing dashboard:', error);
      setError('Failed to load dashboard data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const loadProperties = async () => {
    try {
      const data = await fetchSeenProperties();
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
      setError('Failed to load properties');
    }
  };

  const loadStats = async () => {
    try {
      const data = await fetchDashboardStats();
      setStats(data || {});
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load statistics');
    }
  };

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
    logout();
    navigate('/login');
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadProperties(), loadStats()]);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
    }
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
    const diffTime = now - propertyDate; // Don't use Math.abs - we want actual difference
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Use Math.floor, not Math.ceil
    
    return Math.max(0, diffDays); // Ensure we don't return negative days
  };

  // Get the label for days ago calculation
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
    if (daysAgo === 0) return 'bg-blue-100 text-blue-800'; // Today
    if (daysAgo <= 7) return 'bg-green-100 text-green-800'; // This week
    if (daysAgo <= 30) return 'bg-yellow-100 text-yellow-800'; // This month
    return 'bg-gray-100 text-gray-800'; // Older
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    // Mock profile update
    console.log('Updating profile:', editForm);
    setEditMode(false);
  };

  const refreshData = async () => {
    setLoading(true);
    // Mock refresh
    setTimeout(() => setLoading(false), 1000);
  };

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
      `}</style>

      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Error Display */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.name}!
              </h1>
              <p className="text-gray-600 mt-2">
                Company: {user?.companycode} | Email: {user?.email}
              </p>
              {error && (
                <div className="mt-3 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={refreshData}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
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
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="stat-card bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 text-center border-t-4 border-blue-600">
                  <div className="text-4xl text-blue-600 mb-4">
                    🏠
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Total Properties
                  </h3>
                  <p className="text-3xl font-bold text-blue-600">{stats.total_properties || 0}</p>
                  <p className="text-gray-600 mt-2">Properties viewed</p>
                </div>

                <div className="stat-card bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 text-center border-t-4 border-green-600">
                  <div className="text-4xl text-green-600 mb-4">
                    📅
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Recent Activity
                  </h3>
                  <p className="text-3xl font-bold text-green-600">{stats.recent_properties || 0}</p>
                  <p className="text-gray-600 mt-2">Last 7 days</p>
                </div>

                <div className="stat-card bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 text-center border-t-4 border-red-600">
                  <div className="text-4xl text-red-600 mb-4">
                    📍
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Active States
                  </h3>
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
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPropertyStatusColor(property)}`}>
                            {getDaysAgo(property)} days ago
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
                  onClick={refreshData}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {properties.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl text-gray-300 mb-4">🏠</div>
                  <h4 className="text-xl font-medium text-gray-600 mb-2">No properties yet</h4>
                  <p className="text-gray-500">Your property matches will appear here when the system finds them.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
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
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(property.created_at)}
                          </p>
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
                      {property.contract_date && (
                        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-600 mb-1">Contract Date</p>
                          <p className="font-medium">{formatDate(property.contract_date)}</p>
                        </div>
                      )}
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
                          {getDaysAgo(property)} days ago
                        </span>
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
                        value={editForm.name}
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
                        value={editForm.email}
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
                        value={editForm.token}
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
                          <p className="text-lg font-medium text-gray-900">{user.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Email</p>
                          <p className="text-lg font-medium text-gray-900">{user.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Company Code</p>
                          <p className="text-lg font-medium text-gray-900">{user.companycode}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">CRM Token</p>
                          <p className="text-lg font-medium text-gray-900 font-mono">
                            {user.token?.substring(0, 20)}...
                          </p>
                        </div>
                      </div>
                    </div>

                    {user.states_counties && user.states_counties.length > 0 && (
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
                          <p className="text-lg font-medium text-gray-900">{user.id}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Last Login</p>
                          <p className="text-lg font-medium text-gray-900">
                            {new Date().toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
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
