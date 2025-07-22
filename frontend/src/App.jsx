import React from 'react';
import { Routes, Route } from 'react-router-dom';
import RECTLandingPage from './RECTLandingPage';
import AgentDashboard from './pages/AgentDashboard';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<RECTLandingPage />} />
      <Route path="/dashboard" element={<AgentDashboard />} />
      {/* Add other routes later */}
    </Routes>
  );
};

export default App;
