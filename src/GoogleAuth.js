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
    <button onClick={login}><img src={googleLogin} alt="Sign In with Google"  /></button>
  );
};

export default GoogleAuth;
