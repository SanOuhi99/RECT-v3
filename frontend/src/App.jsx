import React from 'react';
import { Routes, Route , Navigate} from 'react-router-dom';
import RECTLandingPage from './RECTLandingPage';
import AgentLogin from './pages/AgentLogin';
import AgentSignup from './pages/AgentSignup';
import AdminDashboard from './pages/AdminDashboard';

const App = () => {
  return (
    <Routes>
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/" element={<RECTLandingPage />} />
      <Route path="/agent-login" element={<AgentLogin />} />
      <Route path="/agent-signup" element={<AgentSignup />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
};

export default App;
