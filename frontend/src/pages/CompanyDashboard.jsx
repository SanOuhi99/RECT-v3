import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanyAuth } from '../contexts/CompanyAuthContext';
import Navbar from '../components/Navbar';

const CompanyDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({});
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    email: '',
    token: '',
    password: '',
    states_counties: []
  });
  const [statesData, setStatesData] = useState([]);
  const [counties, setCounties] = useState([]);
  const [tempFormState, setTempFormState] = useState({
    state: '',
    county: ''
  });
  const [selectedSelections, setSelectedSelections] = useState([]);

  const { company, logout, updateCompany, fetchCompanyAgents, fetchCompanyStats, fetchCompanyAnalytics, addAgent, deleteAgent, toggleAgentStatus } = useCompanyAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Load states data when add agent modal opens
  useEffect(() => {
    if (showAddAgent) {
      loadStatesData();
    }
  }, [showAddAgent]);

  const loadStatesData = async () => {
    try {
      const response = await fetch(`${company.API_URL || 'https://backend-rectenvironment.up.railway.app'}/states_counties`);
      const data = await response.json();
      setStatesData(data);
    } catch (error) {
      console.error('Error loading states:', error);
    }
  };

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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [agentsData, statsData, analyticsData] = await Promise.all([
        fetchCompanyAgents(),
        fetchCompanyStats(),
        fetchCompanyAnalytics()
      ]);

      setAgents(agentsData || []);
      setStats(statsData || {});
      setAnalytics(analyticsData || {});

      if (!editForm.name && company) {
        setEditForm({
          name: company.name,
          password: '',
          currentPassword: ''
        });
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCompany = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const updateData = {
        name: editForm.name
      };

      if (editForm.currentPassword && editForm.password) {
        updateData.current_password = editForm.currentPassword;
        updateData.new_password = editForm.password;
      }

      const result = await updateCompany(updateData);
      
      if (result.success) {
        setEditMode(false);
        setEditForm(prev => ({
          ...prev,
          password: '',
          currentPassword: ''
        }));
        alert('Company updated successfully!');
      } else {
        setError(result.error || 'Failed to update company');
      }
    } catch (error) {
      console.error('Error updating company:', error);
      setError('Failed to update company');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
  
    try {
      // Validation
      if (!newAgent.name.trim() || !newAgent.email.trim() || !newAgent.token.trim() || !newAgent.password.trim()) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }
  
      if (newAgent.password.length < 6) {
        setError('Password must be at least 6 characters long');
        setLoading(false);
        return;
      }
  
      if (selectedSelections.length === 0) {
        setError('Please select at least one state and county');
        setLoading(false);
        return;
      }
  
      // Transform selectedSelections to match backend structure
      const transformedSelections = selectedSelections.map(selection => ({
        state_FIPS: selection.state_FIPS,
        state_name: selection.state_name,
        counties: selection.counties.map(county => ({
          county_FIPS: county.county_FIPS,
          county_name: county.county_name
        }))
      }));
  
      const agentData = {
        name: newAgent.name.trim(),
        email: newAgent.email.trim(),
        token: newAgent.token.trim(),
        password: newAgent.password,
        states_counties: transformedSelections  // Use transformed data here
      };
  
      const result = await addAgent(agentData);
      
      // Reset form on success
      setShowAddAgent(false);
      setNewAgent({
        name: '',
        email: '',
        token: '',
        password: '',
        states_counties: []
      });
      setSelectedSelections([]);
      setTempFormState({ state: '', county: '' });
      setCounties([]);
      await loadDashboardData();
      alert('Agent added successfully!');
  
    } catch (error) {
      console.error('Error adding agent:', error);
      let errorMessage = 'Failed to add agent';
      
      // Enhanced error parsing
      if (error.response) {
        // Handle HTTP error responses
        try {
          const errorData = await error.response.json();
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail.map(e => 
                `${e.loc?.join('.') || 'field'}: ${e.msg}`
              ).join('\n');
            } else if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else if (errorData.detail.message) {
              errorMessage = `${errorData.detail.message}\n${
                JSON.stringify(errorData.detail.errors, null, 2)
              }`;
            }
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      await deleteAgent(agentId);
      await loadDashboardData();
      alert('Agent deleted successfully!');
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('Failed to delete agent');
    }
  };

  const handleToggleAgentStatus = async (agentId) => {
    try {
      await toggleAgentStatus(agentId);
      await loadDashboardData();
    } catch (error) {
      console.error('Error toggling agent status:', error);
      alert('Failed to update agent status');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/company-login');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && !company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading company dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        .company-header {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .stat-card {
          transition: all 0.3s ease;
          background: linear-gradient(135deg, #ffffff, #f8fafc);
        }
        
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .tab-button {
          transition: all 0.3s ease;
          border-bottom: 3px solid transparent;
        }
        
        .tab-button.active {
          color: #4f46e5;
          border-bottom-color: #4f46e5;
          background-color: rgba(79, 70, 229, 0.05);
        }
        
        .tab-button:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        .agent-card {
          transition: all 0.3s ease;
        }
        
        .agent-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        
        .action-button {
          transition: all 0.2s ease;
        }
        
        .action-button:hover {
          transform: scale(1.05);
        }
      `}</style>

      <Navbar />

      {/* Company Header */}
      <div className="company-header text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold flex items-center">
                <i className="fas fa-building mr-3"></i>
                {company?.name}
              </h1>
              <p className="text-blue-200 mt-1">
                Company Code: {company?.companycode}
              </p>
              <p className="text-sm text-blue-300">
                Company Dashboard
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => loadDashboardData()}
                disabled={loading}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <i className="fas fa-sync-alt mr-2"></i>
                Refresh
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <i className="fas fa-sign-out-alt mr-2"></i>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            {error}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="flex border-b overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: 'fas fa-chart-pie' },
              { id: 'agents', label: 'Agents', icon: 'fas fa-users' },
              { id: 'analytics', label: 'Analytics', icon: 'fas fa-chart-line' },
              { id: 'settings', label: 'Settings', icon: 'fas fa-cog' }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`tab-button px-6 py-4 font-medium whitespace-nowrap ${
                  activeTab === tab.id ? 'active' : 'text-gray-600'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={`${tab.icon} mr-2`}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="stat-card bg-white rounded-xl p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Agents</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.total_agents || 0}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <i className="fas fa-users text-2xl text-blue-600"></i>
                    </div>
                  </div>
                </div>

                <div className="stat-card bg-white rounded-xl p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Agents</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.active_agents || 0}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <i className="fas fa-user-check text-2xl text-green-600"></i>
                    </div>
                  </div>
                </div>

                <div className="stat-card bg-white rounded-xl p-6 border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Properties</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.total_properties || 0}</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <i className="fas fa-home text-2xl text-purple-600"></i>
                    </div>
                  </div>
                </div>

                <div className="stat-card bg-white rounded-xl p-6 border-l-4 border-orange-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">This Month</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.monthly_properties || 0}</p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-full">
                      <i className="fas fa-calendar text-2xl text-orange-600"></i>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    <i className="fas fa-user-plus mr-2 text-blue-600"></i>
                    Recent Agents
                  </h3>
                  <div className="space-y-3">
                    {agents.slice(0, 5).map((agent) => (
                      <div key={agent.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{agent.name}</p>
                          <p className="text-sm text-gray-600">{agent.email}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          agent.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {agent.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    <i className="fas fa-chart-bar mr-2 text-green-600"></i>
                    Top Performing Agents
                  </h3>
                  <div className="space-y-3">
                    {analytics.top_agents?.slice(0, 5).map((agent, index) => (
                      <div key={agent.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <span className="text-lg font-bold text-gray-500 mr-3">#{index + 1}</span>
                          <div>
                            <p className="font-medium text-gray-900">{agent.name}</p>
                            <p className="text-sm text-gray-600">{agent.properties_count} properties</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">{agent.properties_count}</div>
                        </div>
                      </div>
                    )) || (
                      <p className="text-gray-500 text-center py-4">No performance data available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  Company Agents ({agents.length})
                </h3>
                <button
                  onClick={() => setShowAddAgent(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <i className="fas fa-plus mr-2"></i>
                  Add Agent
                </button>
              </div>

              {/* Add Agent Modal */}
              {showAddAgent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Add New Agent</h4>
                    
                    {error && (
                      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                      </div>
                    )}
                    
                    <form onSubmit={handleAddAgent} className="space-y-6">
                      {/* Basic Information */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-3">Basic Information</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-gray-700 mb-2">Name *</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                              value={newAgent.name}
                              onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                              required
                              disabled={loading}
                            />
                          </div>
                          <div>
                            <label className="block text-gray-700 mb-2">Email *</label>
                            <input
                              type="email"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                              value={newAgent.email}
                              onChange={(e) => setNewAgent({...newAgent, email: e.target.value})}
                              required
                              disabled={loading}
                            />
                          </div>
                          <div>
                            <label className="block text-gray-700 mb-2">CRM Token *</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                              value={newAgent.token}
                              onChange={(e) => setNewAgent({...newAgent, token: e.target.value})}
                              required
                              disabled={loading}
                            />
                          </div>
                          <div>
                            <label className="block text-gray-700 mb-2">Password *</label>
                            <input
                              type="password"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                              value={newAgent.password}
                              onChange={(e) => setNewAgent({...newAgent, password: e.target.value})}
                              required
                              minLength="6"
                              disabled={loading}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Service Areas */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-semibold text-gray-900 mb-3">Service Areas *</h5>
                        
                        {/* Add New State/County */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                          <div>
                            <label className="block text-gray-700 mb-2 text-sm">State</label>
                            <select
                              value={tempFormState.state}
                              onChange={handleStateChange}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
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
                            <label className="block text-gray-700 mb-2 text-sm">County</label>
                            <select
                              value={tempFormState.county}
                              onChange={(e) => setTempFormState(prev => ({...prev, county: parseInt(e.target.value, 10)}))}
                              disabled={!tempFormState.state || loading}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
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
                              className="w-full bg-green-600 text-white px-3 py-2 text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              <i className="fas fa-plus mr-1"></i>
                              Add Area
                            </button>
                          </div>
                        </div>

                        {/* Selected Areas Display */}
                        {selectedSelections.length > 0 && (
                          <div className="space-y-3">
                            <h6 className="font-medium text-gray-900 text-sm">Selected Service Areas:</h6>
                            {selectedSelections.map((state, stateIndex) => (
                              <div key={state.state_FIPS} className="bg-white p-3 rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                  <h6 className="font-semibold text-gray-900 text-sm">
                                    {state.state_name} ({state.counties?.length || 0} counties)
                                  </h6>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {state.counties?.map((county, countyIndex) => (
                                    <div
                                      key={county.county_FIPS}
                                      className="flex items-center justify-between bg-blue-50 px-2 py-1 rounded text-xs"
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

                        {selectedSelections.length === 0 && (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            No service areas selected. Please add at least one state and county.
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-4 pt-4">
                        <button
                          type="submit"
                          disabled={loading || selectedSelections.length === 0}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
                        >
                          {loading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Adding Agent...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-plus mr-2"></i>
                              Add Agent
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddAgent(false);
                            setNewAgent({
                              name: '',
                              email: '',
                              token: '',
                              password: '',
                              states_counties: []
                            });
                            setSelectedSelections([]);
                            setTempFormState({ state: '', county: '' });
                            setCounties([]);
                            setError('');
                          }}
                          disabled={loading}
                          className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Agents List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <div key={agent.id} className="agent-card bg-white rounded-lg p-6 shadow-md">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <i className="fas fa-user text-blue-600 text-lg"></i>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{agent.name}</h4>
                          <p className="text-sm text-gray-600">{agent.email}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        agent.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Properties:</span>
                        <span className="font-medium">{agent.property_count || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">States:</span>
                        <span className="font-medium">{agent.assigned_states || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Last Active:</span>
                        <span className="font-medium">{formatDate(agent.last_login)}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleToggleAgentStatus(agent.id)}
                        className={`action-button flex-1 px-3 py-2 text-sm rounded ${
                          agent.is_active 
                            ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        } transition-colors`}
                      >
                        {agent.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="action-button px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {agents.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl text-gray-300 mb-4">👥</div>
                  <h4 className="text-xl font-medium text-gray-600 mb-2">No agents yet</h4>
                  <p className="text-gray-500">Add your first agent to get started</p>
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Company Analytics</h3>
              
              {/* Analytics content would go here */}
              <div className="bg-white rounded-xl p-8 text-center">
                <div className="text-6xl text-gray-300 mb-4">📊</div>
                <h4 className="text-xl font-medium text-gray-600 mb-2">Analytics Coming Soon</h4>
                <p className="text-gray-500">Detailed analytics and reporting features will be available here</p>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="p-6">
              <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Company Settings</h3>
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      editMode 
                        ? 'bg-gray-600 text-white hover:bg-gray-700' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {editMode ? 'Cancel' : 'Edit Settings'}
                  </button>
                </div>

                {editMode ? (
                  <form onSubmit={handleUpdateCompany} className="space-y-6">
                    <div className="bg-gray-50 p-6 rounded-xl">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">Company Name *</label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                            required
                            disabled={loading}
                          />
                        </div>
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">Company Code</label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100"
                            value={company?.companycode || ''}
                            disabled
                          />
                          <p className="text-xs text-gray-500 mt-1">Company code cannot be changed</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">Current Password</label>
                          <input
                            type="password"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                            value={editForm.currentPassword || ''}
                            onChange={(e) => setEditForm({...editForm, currentPassword: e.target.value})}
                            disabled={loading}
                          />
                        </div>
                        <div>
                          <label className="block text-gray-700 mb-2 font-medium">New Password</label>
                          <input
                            type="password"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                            value={editForm.password || ''}
                            onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                            disabled={loading}
                            minLength="6"
                          />
                          <p className="text-xs text-gray-500 mt-1">Leave blank to keep current password</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
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
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h4>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Company Name</p>
                          <p className="text-lg font-medium text-gray-900">{company?.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Company Code</p>
                          <p className="text-lg font-medium text-gray-900">{company?.companycode}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Total Agents</p>
                          <p className="text-lg font-medium text-gray-900">{agents.length}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Active Agents</p>
                          <p className="text-lg font-medium text-gray-900">
                            {agents.filter(agent => agent.is_active).length}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Account Security</h4>
                      <div className="flex items-center justify-between p-4 bg-white rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">Password</p>
                          <p className="text-sm text-gray-600">Last updated: Recently</p>
                        </div>
                        <button
                          onClick={() => setEditMode(true)}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Change Password
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Company Statistics</h4>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Total Properties Tracked</p>
                          <p className="text-lg font-medium text-gray-900">{stats.total_properties || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Properties This Month</p>
                          <p className="text-lg font-medium text-gray-900">{stats.monthly_properties || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Average per Agent</p>
                          <p className="text-lg font-medium text-gray-900">
                            {agents.length > 0 ? Math.round((stats.total_properties || 0) / agents.length) : 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Company Founded</p>
                          <p className="text-lg font-medium text-gray-900">{formatDate(company?.created_at)}</p>
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

export default CompanyDashboard;
