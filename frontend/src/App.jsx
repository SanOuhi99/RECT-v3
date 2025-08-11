import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { CompanyAuthProvider, useCompanyAuth } from './contexts/CompanyAuthContext';

// Import components
import RECTLandingPage from './RECTLandingPage';
import AgentLogin from './pages/AgentLogin';
import AgentSignup from './pages/AgentSignup';
import AgentDashboard from './pages/AgentDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import CompanyRegister from './pages/CompanyRegister';
import CompanyLogin from './pages/CompanyLogin';
import CompanyDashboard from './pages/CompanyDashboard';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import ProtectedCompanyRoute from './components/ProtectedCompanyRoute';

// Protected Route Component for regular users (agents)
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-large animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/agent-login" replace />;
};

// Public Route Component (redirect to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-large animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

// Admin Public Route Component
const AdminPublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-large animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading admin...</p>
        </div>
      </div>
    );
  }

  return !isAuthenticated ? children : <Navigate to="/admin/dashboard" replace />;
};

// Company Public Route Component
const CompanyPublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useCompanyAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-large animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading company portal...</p>
        </div>
      </div>
    );
  }

  return !isAuthenticated ? children : <Navigate to="/company-dashboard" replace />;
};

function AppContent() {
  return (
    <Router>
      <div className="App">
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
        `}</style>
        
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<RECTLandingPage />} />
          
          {/* Agent Routes */}
          <Route 
            path="/agent-login" 
            element={
              <PublicRoute>
                <AgentLogin />
              </PublicRoute>
            } 
          />
          <Route 
            path="/agent-signup" 
            element={
              <PublicRoute>
                <AgentSignup />
              </PublicRoute>
            } 
          />

          {/* Company Routes */}
          <Route 
            path="/company-register" 
            element={
              <CompanyPublicRoute>
                <CompanyRegister />
              </CompanyPublicRoute>
            } 
          />
          <Route 
            path="/company-login" 
            element={
              <CompanyPublicRoute>
                <CompanyLogin />
              </CompanyPublicRoute>
            } 
          />

          {/* Admin Routes */}
          <Route 
            path="/admin/login" 
            element={
              <AdminPublicRoute>
                <AdminLogin />
              </AdminPublicRoute>
            } 
          />
          
          {/* Protected Agent Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <AgentDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Protected Company Routes */}
          <Route 
            path="/company-dashboard" 
            element={
              <ProtectedCompanyRoute>
                <CompanyDashboard />
              </ProtectedCompanyRoute>
            } 
          />

          {/* Protected Admin Routes */}
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            } 
          />
          
          {/* Legacy route redirects */}
          <Route path="/login" element={<Navigate to="/agent-login" replace />} />
          <Route path="/signup" element={<Navigate to="/agent-signup" replace />} />
          
          {/* Catch all route - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <CompanyAuthProvider>
          <AppContent />
        </CompanyAuthProvider>
      </AdminAuthProvider>
    </AuthProvider>
  );
}

export default App;
