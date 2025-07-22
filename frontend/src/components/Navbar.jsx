import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center">
            <i className="fas fa-home text-red-600 text-xl mr-2" />
            <span className="text-xl font-bold text-red-600">RECT</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex space-x-8">
            {['features', 'about', 'contact', 'dashboard'].map((id) => (
              <Link 
                key={id} 
                to={`/${id}`} 
                className="nav-link text-gray-700"
              >
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </Link>
            ))}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            <i className="fas fa-bars text-gray-700" />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-3">
            {['features', 'about', 'contact', 'dashboard'].map((id) => (
              <Link
                key={id}
                to={`/${id}`}
                className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                onClick={() => setMobileOpen(false)}
              >
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
