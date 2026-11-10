import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import GoogleAuth from './GoogleAuth';
import ImageGrid from './ImageGrid';

const ACCOUNTS_KEY = 'driveview.accounts';
const ACTIVE_KEY = 'driveview.activeAccountId';

// A Google OAuth *client* id is public by design (it ships in the JS bundle).
// Set REACT_APP_GOOGLE_CLIENT_ID to point a fork at its own project.
const CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID ||
  '702873253730-3sl9n59ugg2lmu7r4i4tan4md3mjacki.apps.googleusercontent.com';

/** Read stored accounts from localStorage. */
function readStoredAccounts() {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const accounts = JSON.parse(raw);
    if (!Array.isArray(accounts)) return [];
    // Filter out expired accounts
    const now = Date.now();
    return accounts.filter((a) => a.accessToken && a.expiresAt && a.expiresAt > now);
  } catch {
    window.localStorage.removeItem(ACCOUNTS_KEY);
    return [];
  }
}

function readActiveAccountId() {
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeAccounts(accounts) {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* quota/private mode */
  }
}

function writeActiveAccountId(id) {
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* quota/private mode */
  }
}

function generateId() {
  return 'acc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

/** Fetch user info (email, name, picture) from Google using the access token. */
async function fetchUserInfo(accessToken) {
  try {
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (resp.ok) return resp.json();
  } catch {
    /* ignore */
  }
  return { email: 'Unknown', name: 'Unknown', picture: '' };
}

function App() {
  const [accounts, setAccounts] = useState(readStoredAccounts);
  const [activeAccountId, setActiveAccountId] = useState(readActiveAccountId);
  const [message, setMessage] = useState(null);
  const [addingAccount, setAddingAccount] = useState(false);
  const tokenClientRef = useRef(null);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  // Initialize the token client for adding accounts
  useEffect(() => {
    const initTokenClient = () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive',
          prompt: 'select_account',
          callback: '',
        });
      }
    };

    // If already loaded, init immediately
    if (window.google?.accounts?.oauth2) {
      initTokenClient();
    } else {
      // Otherwise wait for the script to load
      const handleLoad = () => {
        if (window.google?.accounts?.oauth2) {
          initTokenClient();
          window.removeEventListener('google-oauth-load', handleLoad);
        }
      };
      window.addEventListener('google-oauth-load', handleLoad);
      // Also check periodically as fallback
      const interval = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          initTokenClient();
          clearInterval(interval);
        }
      }, 200);
      return () => {
        clearInterval(interval);
        window.removeEventListener('google-oauth-load', handleLoad);
      };
    }
  }, []);

  const onFirstSignIn = useCallback((response) => {
    const expiresInMs = Number(response.expires_in || 3600) * 1000;
    const newAccount = {
      id: generateId(),
      accessToken: response.access_token,
      expiresAt: Date.now() + Math.max(expiresInMs - 60000, 0),
    };
    // Fetch user info to populate email/name/avatar
    fetchUserInfo(newAccount.accessToken).then((info) => {
      newAccount.email = info.email;
      newAccount.name = info.name;
      newAccount.picture = info.picture;
      const nextAccounts = [newAccount];
      writeAccounts(nextAccounts);
      writeActiveAccountId(newAccount.id);
      setAccounts(nextAccounts);
      setActiveAccountId(newAccount.id);
    });
  }, []);

  const onAddAccount = useCallback(() => {
    if (!tokenClientRef.current) {
      setMessage('Google auth not ready. Please wait and try again.');
      return;
    }
    setAddingAccount(true);
    tokenClientRef.current.callback = async (response) => {
      setAddingAccount(false);
      if (response.error) {
        setMessage('Failed to add account: ' + (response.error_description || response.error));
        return;
      }
      const expiresInMs = Number(response.expires_in || 3600) * 1000;
      const newAccount = {
        id: generateId(),
        accessToken: response.access_token,
        expiresAt: Date.now() + Math.max(expiresInMs - 60000, 0),
      };
      const info = await fetchUserInfo(newAccount.accessToken);
      newAccount.email = info.email;
      newAccount.name = info.name;
      newAccount.picture = info.picture;
      const nextAccounts = [...accounts, newAccount];
      writeAccounts(nextAccounts);
      writeActiveAccountId(newAccount.id);
      setAccounts(nextAccounts);
      setActiveAccountId(newAccount.id);
    };
    tokenClientRef.current.requestAccessToken();
  }, [accounts]);

  const onSwitchAccount = useCallback((id) => {
    writeActiveAccountId(id);
    setActiveAccountId(id);
  }, []);

  const onRemoveAccount = useCallback((id) => {
    const nextAccounts = accounts.filter((a) => a.id !== id);
    writeAccounts(nextAccounts);
    setAccounts(nextAccounts);
    if (activeAccountId === id) {
      const nextActive = nextAccounts[0]?.id || null;
      writeActiveAccountId(nextActive);
      setActiveAccountId(nextActive);
    }
  }, [accounts, activeAccountId]);

  const handleAuthExpired = useCallback((expiredAccountId) => {
    // Remove the expired account
    const nextAccounts = accounts.filter((a) => a.id !== expiredAccountId);
    writeAccounts(nextAccounts);
    setAccounts(nextAccounts);
    if (activeAccountId === expiredAccountId) {
      const nextActive = nextAccounts[0]?.id || null;
      writeActiveAccountId(nextActive);
      setActiveAccountId(nextActive);
    }
    setMessage('One account session expired and was removed.');
  }, [accounts, activeAccountId]);

  const hasAccounts = accounts.length > 0;

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="app-title">Drive View</h1>

        {message && (
          <p className="app-message" role="alert">
            {message}
          </p>
        )}

        {hasAccounts && (
          <div className="account-bar">
            <span className="account-label">Account:</span>
            <select
              className="account-select"
              value={activeAccountId}
              onChange={(e) => onSwitchAccount(e.target.value)}
              aria-label="Switch Google account"
            >
              {accounts.map((acc, idx) => (
                <option key={acc.id} value={acc.id}>
                  {acc.picture && <img src={acc.picture} alt="" className="account-avatar" />}
                  {acc.email} #{idx + 1}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-small"
              onClick={onAddAccount}
              disabled={addingAccount}
              aria-label="Add another Google account"
            >
              {addingAccount ? 'Adding…' : '+ Add account'}
            </button>
            {accounts.length > 1 && (
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() => onRemoveAccount(activeAccountId)}
                aria-label="Remove this account"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              className="btn btn-small btn-danger"
              onClick={() => {
                writeAccounts([]);
                writeActiveAccountId(null);
                setAccounts([]);
                setActiveAccountId(null);
              }}
              aria-label="Sign out of all accounts"
            >
              Sign out
            </button>
          </div>
        )}

        <GoogleOAuthProvider clientId={CLIENT_ID}>
          {hasAccounts ? (
            <ImageGrid
              accounts={accounts}
              activeAccountId={activeAccountId}
              onAuthExpired={handleAuthExpired}
            />
          ) : (
            <GoogleAuth onSuccess={onFirstSignIn} onError={() => setMessage('Google sign-in failed. Please try again.')} clientId={CLIENT_ID} />
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