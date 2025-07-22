import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';

const AgentSignup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    token: '',
    company_code: '',
    state: '',
    county: ''
  });
  const [statesData, setStatesData] = useState([]);
  const [counties, setCounties] = useState([]);
  const [selectedSelections, setSelectedSelections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStates = async () => {
      try {
        setIsLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL;
        if (!apiUrl) throw new Error('API URL is not configured');
        
        const apiUrl = import.meta.env.VITE_API_URL;
        if (!apiUrl) throw new Error('API URL is not configured');
        const response = await fetch(`${apiUrl}/states_counties`);
        setStatesData(data);
        setError(null);
      } catch (err) {
        console.error('Error loading states:', err);
        setError('Failed to load states data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStates();
  }, []);

  const handleStateChange = (e) => {
    const stateFIPS = e.target.value;
    const selectedState = statesData.find(s => s.state_FIPS === stateFIPS);
    setCounties(selectedState?.counties || []);
    setFormData(prev => ({
      ...prev,
      state: stateFIPS,
      county: ''
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addSelection = () => {
    if (!formData.state || !formData.county) {
      alert("Please select both state and county");
      return;
    }

    const state = statesData.find(s => s.state_FIPS === formData.state);
    const county = counties.find(c => c.county_FIPS === formData.county);

    const newSelection = {
      state_FIPS: formData.state,
      state_name: state.state_name,
      county_FIPS: formData.county,
      county_name: county.county_name
    };

    setSelectedSelections(prev => [...prev, newSelection]);
    setFormData(prev => ({
      ...prev,
      state: '',
      county: ''
    }));
  };

  const removeSelection = (index) => {
    setSelectedSelections(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.token || !formData.company_code || selectedSelections.length === 0) {
      alert("Please fill all fields and add at least one state/county selection");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/crm_owners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          token: formData.token,
          company_code: formData.company_code,
          states_counties: selectedSelections
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save CRM owner');
      }

      alert("Registration successful!");
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      alert(`Registration failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Agent Registration</h2>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-2">API Token</label>
                <input
                  type="text"
                  name="token"
                  value={formData.token}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 mb-2">Company Code</label>
                <input
                  type="text"
                  name="company_code"
                  value={formData.company_code}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                  required
                />
              </div>
            </div>
            
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Service Areas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="block text-gray-700 mb-2">State</label>
                  <select
                    value={formData.state}
                    onChange={handleStateChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                  >
                    <option value="">Select a state</option>
                    {statesData.map(state => (
                      <option key={state.state_FIPS} value={state.state_FIPS}>
                        {state.state_name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-gray-700 mb-2">County</label>
                  <select
                    value={formData.county}
                    onChange={(e) => handleInputChange({
                      target: { name: 'county', value: e.target.value }
                    })}
                    disabled={!formData.state}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                  >
                    <option value="">Select a county</option>
                    {counties.map(county => (
                      <option key={county.county_FIPS} value={county.county_FIPS}>
                        {county.county_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <button
                type="button"
                onClick={addSelection}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors mb-4"
              >
                Add Service Area
              </button>
              
              {selectedSelections.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <ul className="divide-y">
                    {selectedSelections.map((selection, index) => (
                      <li 
                        key={`${selection.state_FIPS}-${selection.county_FIPS}`}
                        className="p-3 hover:bg-gray-50 flex justify-between items-center"
                      >
                        <span>{selection.state_name} - {selection.county_name}</span>
                        <button
                          type="button"
                          onClick={() => removeSelection(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className={`px-6 py-2 rounded-lg text-white ${isLoading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'} transition-colors`}
              >
                {isLoading ? 'Processing...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AgentSignup;
