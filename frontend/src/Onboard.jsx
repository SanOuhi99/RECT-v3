import React, { useState, useEffect } from 'react';

export default function Onboard() {
  const apiUrl = import.meta.env.VITE_API_URL;

  const [form, setForm] = useState({
    name: '',
    email: '',
    token: '',
    company_code: '',
  });
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [counties, setCounties] = useState([]);
  const [selectedCounty, setSelectedCounty] = useState('');
  const [savedPairs, setSavedPairs] = useState([]); // { state_FIPS, state_name, county_FIPS, county_name }

  // ---------- load states ----------
  useEffect(() => {
    fetch(`${apiUrl}/states_counties`)
      .then(r => r.json())
      .then(setStates)
      .catch(console.error);
  }, [apiUrl]);

  // ---------- when state changes ----------
  useEffect(() => {
    if (!selectedState) {
      setCounties([]);
      return;
    }
    const st = states.find(s => s.state_FIPS === +selectedState);
    setCounties(st ? st.counties : []);
    setSelectedCounty('');
  }, [selectedState, states]);

  // ---------- add state-county pair ----------
  const addPair = () => {
    if (!selectedState || !selectedCounty) return;
    const st = states.find(s => s.state_FIPS === +selectedState);
    const co = st.counties.find(c => c.county_FIPS === +selectedCounty);
    const pair = {
      state_FIPS: st.state_FIPS,
      state_name: st.state_name,
      county_FIPS: co.county_FIPS,
      county_name: co.county_name,
    };
    setSavedPairs(prev => [...prev, pair]);
    setSelectedState('');
    setSelectedCounty('');
  };

  // ---------- remove pair ----------
  const removePair = idx =>
    setSavedPairs(prev => prev.filter((_, i) => i !== idx));

  // ---------- submit ----------
  const submit = () => {
    if (!form.name || !form.email || !form.token || !form.company_code) {
      alert('Please fill all fields.');
      return;
    }

    fetch(`${apiUrl}/crm_owners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, states_counties: savedPairs }),
    })
      .then(r => {
        if (r.ok) {
          alert('CRM Owner saved!');
          setForm({ name: '', email: '', token: '', company_code: '' });
          setSavedPairs([]);
        } else r.text().then(alert);
      })
      .catch(console.error);
  };

  return (
    <div className="container mt-4">
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <a className="navbar-brand" href="#">
          <img
            src="logo.jpg"
            alt="RECT Logo"
            style={{ height: 200, width: 500 }}
          />
        </a>
      </nav>

      <h2 className="mt-3">CRM Owner Entry</h2>

      <div className="mb-3">
        <label className="form-label">Enter Name:</label>
        <input
          type="text"
          className="form-control"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Enter Email:</label>
        <input
          type="email"
          className="form-control"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Enter Token:</label>
        <textarea
          className="form-control"
          rows={2}
          value={form.token}
          onChange={e => setForm({ ...form, token: e.target.value })}
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Company Code:</label>
        <textarea
          className="form-control"
          rows={2}
          value={form.company_code}
          onChange={e => setForm({ ...form, company_code: e.target.value })}
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Select a State:</label>
        <select
          className="form-select"
          value={selectedState}
          onChange={e => setSelectedState(e.target.value)}
        >
          <option value="">-- Select State --</option>
          {states.map(s => (
            <option key={s.state_FIPS} value={s.state_FIPS}>
              {s.state_name}
            </option>
          ))}
        </select>
      </div>

      {counties.length > 0 && (
        <div className="mb-3">
          <label className="form-label">Select a County:</label>
          <select
            className="form-select"
            value={selectedCounty}
            onChange={e => setSelectedCounty(e.target.value)}
          >
            <option value="">-- Select County --</option>
            {counties.map(c => (
              <option key={c.county_FIPS} value={c.county_FIPS}>
                {c.county_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        className="btn btn-primary me-2"
        onClick={addPair}
        disabled={!selectedState || !selectedCounty}
      >
        Save Selection
      </button>

      <button className="btn btn-success" onClick={submit}>
        Save CRM Owner
      </button>

      <h4 className="mt-4">Saved Selections:</h4>
      <ul className="list-group">
        {savedPairs.map((p, idx) => (
          <li
            key={idx}
            className="list-group-item d-flex justify-content-between"
          >
            {p.state_name} - {p.county_name}
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => removePair(idx)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
