import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import GoogleAuth from './GoogleAuth';
import ImageGrid from './ImageGrid';

const STORAGE_KEY = 'driveview.auth';

// A Google OAuth *client* id is public by design (it ships in the JS bundle).
// Set REACT_APP_GOOGLE_CLIENT_ID to point a fork at its own project.
const CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID ||
  '702873253730-3sl9n59ugg2lmu7r4i4tan4md3mjacki.apps.googleusercontent.com';

/**
 * Read a previously stored session.
 *
 * Stores the expiry alongside the token so an obviously dead token does not
 * sit in localStorage until the first Drive request fails.
 */
function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw);
    if (!session.accessToken) return null;
    if (session.expiresAt && session.expiresAt <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function App() {
  const [session, setSession] = useState(readStoredSession);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  const onSuccess = useCallback((response) => {
    const expiresInMs = Number(response.expires_in || 3600) * 1000;
    const next = {
      accessToken: response.access_token,
      // Expire a minute early so a request never races the token lifetime.
      expiresAt: Date.now() + Math.max(expiresInMs - 60000, 0),
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode / quota — the session still works for this tab */
    }
    setSession(next);
  }, []);

  const onError = useCallback(() => {
    setMessage('Google sign-in failed. Please try again.');
  }, []);

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  /** Called when Drive answers 401 — the token is dead, start over. */
  const handleAuthExpired = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setMessage('Your Google session expired — please sign in again.');
  }, []);

  const accessToken = session?.accessToken || '';

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="app-title">Drive View</h1>

        {message && (
          <p className="app-message" role="alert">
            {message}
          </p>
        )}

        {accessToken && (
          <button type="button" className="btn btn-danger" onClick={handleLogout}>
            Logout
          </button>
        )}

        <GoogleOAuthProvider clientId={CLIENT_ID}>
          {accessToken ? (
            <ImageGrid accessToken={accessToken} onAuthExpired={handleAuthExpired} />
          ) : (
            <GoogleAuth onSuccess={onSuccess} onError={onError} clientId={CLIENT_ID} />
          )}
        </GoogleOAuthProvider>

        <footer className="app-footer">
          <a
            href="https://script.google.com/macros/s/AKfycbzB0UaTxguR8i8MrcZlSI3cPIsb_-hLgEckT-6UzKBw0ZOYFDgplbJB_OnA3gUebIlS/exec"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Google Apps Script Project
          </a>
        </footer>
      </header>
    </div>
  );
}

export default App;
