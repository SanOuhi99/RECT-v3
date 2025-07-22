import React from 'react';
import Navbar from '../components/Navbar';

const AdminDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Admin Controls</h2>
          {/* Add admin-specific content here */}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
