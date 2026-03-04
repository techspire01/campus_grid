import React from 'react';

function ProtectedRoute({ isAuthenticated, children }) {
  return children;
}

export default ProtectedRoute;
