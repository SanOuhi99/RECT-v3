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
            <a href="#features" className="nav-link text-gray-700 hover:text-red-600">
              Features
            </a>
            <a href="#about" className="nav-link text-gray-700 hover:text-red-600">
              About
            </a>
            <a href="#contact" className="nav-link text-gray-700 hover:text-red-600">
              Contact
            </a>
            <Link 
              to="/admin/login"
              className="nav-link text-gray-700 hover:text-red-600 text-sm"
            >
              <i className="fas fa-shield-alt mr-1"></i>
              Admin
            </Link>
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
        {process.env.NODE_ENV === 'development' && (
          <Link 
            to="/admin/login"
            className="nav-link text-gray-500 text-sm"
          >
            Admin
          </Link>
        )}
        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-3">
            <a href="#features" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
              Features
            </a>
            <a href="#about" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
              About
            </a>
            <a href="#contact" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
              Contact
            </a>
            <Link
              to="/admin/login"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
              onClick={() => setMobileOpen(false)}
            >
              Admin
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
