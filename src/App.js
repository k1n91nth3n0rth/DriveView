import React, { useState, useEffect } from 'react';
import './App.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import GoogleAuth from './GoogleAuth';
import ImageGrid from './ImageGrid';

function App() {
  const [accessToken, setAccessToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const clientId = '702873253730-3sl9n59ugg2lmu7r4i4tan4md3mjacki.apps.googleusercontent.com';

  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    if (storedToken) {
      setAccessToken(storedToken);
      setIsAuthenticated(true);
    }
  }, []);

  const onSuccess = (response) => {
    console.log('Google authentication successful:', response);
    localStorage.setItem('accessToken', response.access_token);
    setAccessToken(response.access_token);
    setIsAuthenticated(true);
  };

  const onError = (error) => {
    console.error('Google authentication error:', error);
    alert('Google authentication failed. Please try again.');
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    setAccessToken('');
    setIsAuthenticated(false);
  };
  
 

  return (
    <div className="App">
      <header className="App-header">
        <h1 style={{ marginBottom: '5px' }}>Drive View</h1>  
        {accessToken && (
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            fontSize: '16px',
            borderRadius: '6px',
            backgroundColor: '#ff4d4f',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '20px',
          }}
        >
          Logout
        </button>
      )}

      
        
        <br></br>
        <GoogleOAuthProvider clientId={clientId}>
          {accessToken ? (
            <ImageGrid accessToken={accessToken} />
          ) : (
            <GoogleAuth onSuccess={onSuccess} onError={onError} clientId={clientId} />
          )}
        </GoogleOAuthProvider>
        {/* ✅ Footer link */}
        <div style={{ marginBottom: '30px', fontSize: '14px' }}>
          <a
            href="https://script.google.com/macros/s/AKfycbzB0UaTxguR8i8MrcZlSI3cPIsb_-hLgEckT-6UzKBw0ZOYFDgplbJB_OnA3gUebIlS/exec"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#ccc', textDecoration: 'underline' }}
          >
            Open Google Apps Script Project
          </a>
        </div>
      </header>
    </div>
  );
}

export default App;
