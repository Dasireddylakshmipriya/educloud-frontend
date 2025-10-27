// In src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

import { Amplify } from 'aws-amplify';

// Full Amplify config, supporting Auth, S3, and REST API use
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_teMarUIDB',
      userPoolClientId: '70vsvgft7rk6f11c6hurm3t0n3',
      identityPoolId: 'us-east-1:36097fd9-e2e2-4908-ba53-d8b302eb7b14',
      loginWith: {
        email: true,
        oauth: {
          domain: 'educloudfrontend16c2439c-16c2439c-cleanenv.auth.us-east-1.amazoncognito.com',
          scopes: ['phone', 'email', 'openid', 'profile', 'aws.cognito.signin.user.admin'],
          redirectSignIn: ['http://localhost:5173/'],
          redirectSignOut: ['http://localhost:5173/'],
          responseType: 'code'
        }
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: {
          required: true
        }
      },
      allowGuestAccess: true,
      passwordFormat: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireNumbers: false,
        requireSpecialCharacters: false
      }
    }
  },
  Storage: {
    S3: {
      bucket: 'educloudfrontend2bf38c8bc5dc4051a5746eb0aace1a63c289-cleanenv',
      region: 'us-east-1'
    }
  },
  API: {
    REST: {
      'EduCloud-Summarizer-API': {
        endpoint: 'https://bnksajuxeg.execute-api.us-east-1.amazonaws.com/default',
        region: 'us-east-1'
      }
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
