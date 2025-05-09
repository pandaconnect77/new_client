import React, { useState, useEffect } from 'react';
import ChatRoom from './ChatRoom';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const CORRECT_PASSWORD = 'bgmnpt@123';

  // Load from localStorage on mount
  useEffect(() => {
    const storedAuth = localStorage.getItem('authenticated');
    const storedRole = localStorage.getItem('role');

    if (storedAuth === 'true' && storedRole) {
      setAuthenticated(true);
      setRole(storedRole);
    }
  }, []);

  const handleLogin = () => {
    if (password === CORRECT_PASSWORD) {
      setAuthenticated(true);
      localStorage.setItem('authenticated', 'true');
    } else {
      alert('Wrong password. Please try again.');
    }
  };

  const handleRoleSelect = () => {
    if (selectedRole) {
      setRole(selectedRole);
      localStorage.setItem('role', selectedRole);
    } else {
      alert('Please select a role to enter chat');
    }
  };

  if (!authenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">Enter Here</h1>
          <input
            type="password"
            className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter Here"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md transition"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Select Your Role</h2>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">-- Select --</option>
            <option value="F">F</option>
            <option value="M">M</option>
          </select>
          <button
            onClick={handleRoleSelect}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-md transition"
          >
            Enter 
          </button>
        </div>
      </div>
    );
  }

  return <ChatRoom role={role} />;
}
