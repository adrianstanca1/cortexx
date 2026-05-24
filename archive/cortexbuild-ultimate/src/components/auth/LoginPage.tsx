import { LoginStyles } from './loginStyles';
import { LoginHero } from './LoginHero';
import { LoginForm } from './LoginForm';

/**
 * Top-level login orchestrator.
 *
 * Composes three concerns:
 *   1. <LoginStyles />  – global keyframes + utility classes (mounted once)
 *   2. <LoginHero />    – marketing/visual panel (desktop only)
 *   3. <LoginForm />    – authentication UI (email/password + OAuth)
 *
 * The previous monolithic implementation lived in this file at ~850 lines;
 * it has been split for maintainability. Auth flow itself is unchanged.
 */
export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#080b12',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <LoginStyles />
      <LoginHero />
      <LoginForm />
    </div>
  );
}
