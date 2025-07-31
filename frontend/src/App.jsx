// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RECTLandingPage from './RECTLandingPage';
import AgentLogin from './pages/AgentLogin';
import AgentSignup from './pages/AgentSignup';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';

const App = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<RECTLandingPage />} />
        <Route path="/agent-login" element={<AgentLogin />} />
        <Route path="/agent-signup" element={<AgentSignup />} />
        
        {/* Protected routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <AgentDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* Admin route - you can add protection here too if needed */}
        <Route path="/admin" element={<AdminDashboard />} />
        
        {/* Redirect any unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
