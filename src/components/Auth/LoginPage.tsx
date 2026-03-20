import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const { signIn, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const result = await signIn(email, password);
    if (result.error) setError(result.error);
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/',
    });
    setResetLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <svg className="login-logo" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="56" height="56" rx="14" fill="#01696f" />
          <path d="M18 18h20v4H31v16h-6V22H18v-4z" fill="white" />
          <path d="M14 24c-2 2-3 5-3 8s1 6 3 8" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
          <path d="M42 24c2 2 3 5 3 8s-1 6-3 8" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
        </svg>
        <h1 className="login-title">Atlas HQ</h1>
        <p className="login-subtitle">Corporate Operations</p>

        <div className="login-card">
          {resetMode ? (
            resetSent ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✉️</div>
                <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-tx)' }}>Check your email</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-tx-muted)', marginBottom: '1.5rem' }}>
                  We sent a password reset link to <strong>{email}</strong>
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  onClick={() => { setResetMode(false); setResetSent(false); setError(''); }}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword}>
                <h3 style={{ marginBottom: '0.25rem', color: 'var(--color-tx)' }}>Reset Password</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-tx-muted)', marginBottom: '1rem' }}>
                  Enter your email and we'll send you a reset link.
                </p>
                <div className="form-row">
                  <label className="field-label" htmlFor="reset-email">Email</label>
                  <input
                    type="email"
                    id="reset-email"
                    className="input-field"
                    placeholder="you@talaria.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                {error && <div className="login-error" style={{ display: 'block' }}>{error}</div>}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginBottom: '0.75rem' }}
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ width: '100%', fontSize: 'var(--text-sm)' }}
                  onClick={() => { setResetMode(false); setError(''); }}
                >
                  Back to Sign In
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label className="field-label" htmlFor="auth-email">Email</label>
                <input
                  type="email"
                  id="auth-email"
                  className="input-field"
                  placeholder="you@talaria.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="field-label" htmlFor="auth-password">Password</label>
                <input
                  type="password"
                  id="auth-password"
                  className="input-field"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              {error && <div className="login-error" style={{ display: 'block' }}>{error}</div>}
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginBottom: '0.75rem' }}
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: 'var(--text-sm)', color: 'var(--color-tx-muted)' }}
                onClick={() => { setResetMode(true); setError(''); }}
              >
                Forgot password?
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
