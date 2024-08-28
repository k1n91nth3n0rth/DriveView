import React, { useState } from 'react';
import './App.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import GoogleAuth from './GoogleAuth';
import ImageGrid from './ImageGrid';

function App() {
  const [accessToken, setAccessToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const clientId = '702873253730-3sl9n59ugg2lmu7r4i4tan4md3mjacki.apps.googleusercontent.com';

  const onSuccess = (response) => {
    console.log('Google authentication successful:', response);
    setAccessToken(response.access_token);
    setIsAuthenticated(true);
  };

  const onError = (error) => {
    console.error('Google authentication error:', error);
    alert('Google authentication failed. Please try again.');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1 style={{ marginBottom: '5px' }}>Drive View</h1>        
        
        <br></br>
        <GoogleOAuthProvider clientId={clientId}>
          {accessToken ? (
            <ImageGrid accessToken={accessToken} />
          ) : (
            <GoogleAuth onSuccess={onSuccess} onError={onError} clientId={clientId} />
          )}
        </GoogleOAuthProvider>
      </header>
    </div>
  );
}

export default App;
