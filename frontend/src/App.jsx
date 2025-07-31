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
        <Route path="/login" element={<AgentLogin />} /> {/* Add this alias */}
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
        
        {/* Admin route */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* Redirect any unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
