import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../../stores/authStore';

export default function LoginPage() {
  const { signIn, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const result = await signIn(email, password);
    if (result.error) setError(result.error);
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
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
