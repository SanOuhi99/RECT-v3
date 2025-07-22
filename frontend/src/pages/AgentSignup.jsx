import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

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

  useEffect(() => {
    // Load states data using VITE_API_URL
    fetch(`${import.meta.env.VITE_API_URL}/states_counties`)
      .then(response => response.json())
      .then(data => setStatesData(data))
      .catch(error => console.error('Error loading states:', error));
  }, []);

  const handleStateChange = (e) => {
    const stateFIPS = e.target.value;
    setFormData({...formData, state: stateFIPS});
    
    const selectedState = statesData.find(s => s.state_FIPS === stateFIPS);
    setCounties(selectedState ? selectedState.counties : []);
    setFormData(prev => ({...prev, county: ''}));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({...formData, [name]: value});
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

    setSelectedSelections([...selectedSelections, newSelection]);
  };

  const removeSelection = (index) => {
    const updatedSelections = [...selectedSelections];
    updatedSelections.splice(index, 1);
    setSelectedSelections(updatedSelections);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.token || !formData.company_code || selectedSelections.length === 0) {
      alert("Please fill all fields and add at least one state/county selection");
      return;
    }

    const crmOwner = {
      name: formData.name,
      email: formData.email,
      token: formData.token,
      company_code: formData.company_code,
      states_counties: selectedSelections
    };

    fetch(`${import.meta.env.VITE_API_URL}/crm_owners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(crmOwner),
    })
    .then(response => {
      if (!response.ok) throw new Error(response.statusText);
      alert("CRM Owner saved successfully!");
      // Reset form
      setFormData({
        name: '',
        email: '',
        token: '',
        company_code: '',
        state: '',
        county: ''
      });
      setSelectedSelections([]);
    })
    .catch(error => {
      alert(`Error saving CRM Owner: ${error.message}`);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">CRM Owner Entry</h2>
          
          <form onSubmit={handleSubmit}>
            {/* ... (rest of your form JSX remains exactly the same) ... */}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AgentSignup;
