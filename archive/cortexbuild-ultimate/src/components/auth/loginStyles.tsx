/**
 * Shared keyframes and utility classes for the login experience.
 *
 * Mounted once by <LoginPage>. Splitting the styles out of the orchestrator
 * keeps LoginHero / LoginForm focused on structure, not animation chrome.
 */
export function LoginStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

      @keyframes slideUp {
        from { opacity: 0; transform: translateY(14px); }
        to   { opacity: 1; transform: translateY(0);    }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes scanLine {
        0%   { transform: translateY(0);    opacity: 0; }
        10%  { opacity: 0.6; }
        90%  { opacity: 0.6; }
        100% { transform: translateY(520px); opacity: 0; }
      }
      @keyframes ticker {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      @keyframes borderGlow {
        0%, 100% { box-shadow: 0 0 0 1px rgba(245,158,11,0.3), 0 0 12px rgba(245,158,11,0.08); }
        50%       { box-shadow: 0 0 0 1px rgba(245,158,11,0.6), 0 0 24px rgba(245,158,11,0.15); }
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      .auth-input {
        width: 100%;
        background: rgba(13,17,23,0.8);
        border: 1px solid rgba(30,41,59,0.9);
        border-radius: 10px;
        padding: 12px 16px;
        color: #f1f5f9;
        font-family: 'DM Sans', sans-serif;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
        box-sizing: border-box;
      }
      .auth-input::placeholder { color: rgba(90,106,130,0.7); }
      .auth-input:focus {
        border-color: rgba(245,158,11,0.6);
        box-shadow: 0 0 0 3px rgba(245,158,11,0.08);
      }
      .auth-input-icon { padding-left: 42px; }

      .submit-btn {
        width: 100%;
        padding: 13px 20px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        border: none;
        border-radius: 10px;
        color: #080b12;
        font-family: 'Syne', sans-serif;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.04em;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 4px 20px rgba(245,158,11,0.25);
      }
      .submit-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 28px rgba(245,158,11,0.35);
      }
      .submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }

      .mode-link {
        background: none;
        border: none;
        cursor: pointer;
        color: #f59e0b;
        font-family: 'DM Sans', sans-serif;
        font-size: 13px;
        font-weight: 600;
        padding: 0;
        transition: color 0.2s;
      }
      .mode-link:hover { color: #fbbf24; }

      .ticker-track {
        display: flex;
        gap: 0;
        animation: ticker 28s linear infinite;
        white-space: nowrap;
      }

      @media (min-width: 900px) {
        .hero-panel { display: flex !important; }
      }
      @media (max-width: 899px) {
        .hero-panel { display: none !important; }
      }
    `}</style>
  );
}

export default LoginStyles;
