import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const AgentDashboard = () => {
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchUserData();
    fetchProperties();
    fetchStats();
  }, [navigate]);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const userData = await response.json();
      setUser(userData);
      setEditForm({
        name: userData.name,
        email: userData.email,
        token: userData.token,
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  const fetchProperties = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/seen_properties`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProperties(data);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/seen_properties/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        setEditMode(false);
        alert('Profile updated successfully!');
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-large"></div>
          <p className="text-gray-600 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        :root {
          --primary: #2c3e50;
          --secondary: #e74c3c;
          --accent: #3498db;
          --light: #ecf0f1;
          --dark: #2c3e50;
        }
        
        .feature-card {
          transition: all 0.3s ease;
        }
        
        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }
        
        .btn-primary-custom {
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          border: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
        }
        
        .btn-primary-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
        }
        
        .btn-secondary {
          background: #6c757d;
          color: white;
          border: none;
          transition: all 0.3s ease;
        }
        
        .btn-secondary:hover {
          background: #5a6268;
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
        
        .tab-button:hover {
          color: #e74c3c;
        }
        
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
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          margin-bottom: 16px;
          transition: all 0.3s ease;
        }
        
        .property-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(0,0,0,0.15);
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
            </div>
            <button
              onClick={handleLogout}
              className="btn-secondary px-4 py-2 rounded-lg"
            >
              Logout
            </button>
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
              Seen Properties
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
                <div className="feature-card bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 text-center border-t-4 border-blue-600">
                  <div className="text-4xl text-blue-600 mb-4">
                    <i className="fas fa-home"></i>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Total Properties
                  </h3>
                  <p className="text-3xl font-bold text-blue-600">{stats.total_properties || 0}</p>
                  <p className="text-gray-600 mt-2">Properties viewed</p>
                </div>

                <div className="feature-card bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 text-center border-t-4 border-green-600">
                  <div className="text-4xl text-green-600 mb-4">
                    <i className="fas fa-calendar-week"></i>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Recent Activity
                  </h3>
                  <p className="text-3xl font-bold text-green-600">{stats.recent_properties || 0}</p>
                  <p className="text-gray-600 mt-2">Last 7 days</p>
                </div>

                <div className="feature-card bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 text-center border-t-4 border-red-600">
                  <div className="text-4xl text-red-600 mb-4">
                    <i className="fas fa-map-marker-alt"></i>
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
            </div>
          )}

          {/* Properties Tab */}
          {activeTab === 'properties' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  Your Seen Properties ({properties.length})
                </h3>
              </div>

              {properties.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl text-gray-300 mb-4">
                    <i className="fas fa-home"></i>
                  </div>
                  <h4 className="text-xl font-medium text-gray-600 mb-2">No properties yet</h4>
                  <p className="text-gray-500">Start viewing properties to see them here.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {properties.map((property) => (
                    <div key={property.id} className="property-card">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">
                            {property.street_address || 'Address not available'}
                          </h4>
                          <p className="text-gray-600">
                            {property.county}, {property.state}
                          </p>
                        </div>
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          ID: {property.property_id}
                        </span>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-gray-600">Owner Name</p>
                          <p className="font-medium">{property.owner_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Seller Name</p>
                          <p className="font-medium">{property.seller_name || 'N/A'}</p>
                        </div>
                      </div>

                      {property.contact_email && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-600">Contact</p>
                          <p className="font-medium">
                            {property.contact_first_name} {property.contact_last_name}
                          </p>
                          <p className="text-sm text-blue-600">{property.contact_email}</p>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                        <span className="text-sm text-gray-500">
                          Viewed: {formatDate(property.created_at)}
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
                    className={`px-4 py-2 rounded-lg ${editMode ? 'btn-secondary' : 'btn-primary-custom'}`}
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
                      />
                    </div>
                    <div className="flex space-x-4">
                      <button
                        type="submit"
                        className="btn-primary-custom px-6 py-3 rounded-lg text-white"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditMode(false)}
                        className="btn-secondary px-6 py-3 rounded-lg"
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
