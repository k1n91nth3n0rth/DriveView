import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import googleLogin from './images/web_neutral_sq_SI.svg';

const GoogleAuth = ({ onSuccess, onError, clientId }) => {
  const login = useGoogleLogin({
    clientId,
    onSuccess,
    onError,
    scope: 'https://www.googleapis.com/auth/drive',
  });

  return (
    <button
      type="button"
      className="google-signin"
      onClick={login}
      aria-label="Sign in with Google"
      title="Sign in with Google"
    >
      <img src={googleLogin} alt="" />
    </button>
  );
};

export default GoogleAuth;
