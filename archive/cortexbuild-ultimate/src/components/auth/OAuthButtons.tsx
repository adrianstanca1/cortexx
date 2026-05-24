import React from 'react';

interface OAuthButtonProps {
  provider: 'google' | 'microsoft';
  onClick?: () => void;
  className?: string;
}

export function OAuthButton({ provider, onClick, className = '' }: OAuthButtonProps) {
  const handleOAuthClick = () => {
    // Full-page navigation to the API host so the OAuth session cookie matches
    // GOOGLE_CALLBACK_URL / MICROSOFT_CALLBACK_URL (see docker-compose / .env).
    // return_origin lets the server redirect back to this Vite port after sign-in.
    const apiOrigin = (import.meta.env.VITE_OAUTH_API_ORIGIN || '').replace(/\/$/, '');
    const base =
      apiOrigin ||
      (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);
    const returnOrigin = encodeURIComponent(window.location.origin);
    window.location.href = `${base}/api/auth/${provider}?return_origin=${returnOrigin}`;
    onClick?.();
  };

  if (provider === 'google') {
    return (
      <button
        type="button"
        onClick={handleOAuthClick}
        className={`oauth-button google ${className}`}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: '#ffffff',
          border: '1px solid rgba(30,41,59,0.9)',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          fontWeight: 500,
          color: '#1e293b',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f8fafc';
          e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#ffffff';
          e.currentTarget.style.borderColor = 'rgba(30,41,59,0.9)';
        }}
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </button>
    );
  }

  if (provider === 'microsoft') {
    return (
      <button
        type="button"
        onClick={handleOAuthClick}
        className={`oauth-button microsoft ${className}`}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: '#2F2F2F',
          border: '1px solid rgba(30,41,59,0.9)',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          fontWeight: 500,
          color: '#ffffff',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#3A3A3A';
          e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#2F2F2F';
          e.currentTarget.style.borderColor = 'rgba(30,41,59,0.9)';
        }}
      >
        <MicrosoftIcon />
        <span>Continue with Microsoft</span>
      </button>
    );
  }

  return null;
}

function GoogleIcon() {
  // Official four-colour Google "G" mark.
  // Source: Google Identity branding guidelines (24×24 viewBox).
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.5-1.12 2.77-2.39 3.62v3h3.86c2.26-2.09 3.58-5.17 3.58-8.86z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.07.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.875 1.875H9.375V9.375H1.875V1.875Z" fill="#F25022"/>
      <path d="M10.625 1.875H18.125V9.375H10.625V1.875Z" fill="#7FBA00"/>
      <path d="M1.875 10.625H9.375V18.125H1.875V10.625Z" fill="#00A4EF"/>
      <path d="M10.625 10.625H18.125V18.125H10.625V10.625Z" fill="#FFB900"/>
    </svg>
  );
}

export default OAuthButton;
