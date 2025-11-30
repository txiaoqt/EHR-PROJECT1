// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../AuthContext.jsx';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !pass) {
      setMsg('Please enter email and password');
      return;
    }
    setLoading(true);
    setMsg('');

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email, password, avatar, role')
        .eq('email', email)
        .eq('active', true);

      if (error) {
        console.error(error);
        setMsg('Login failed');
        setLoading(false);
        return;
      }

      if (!users || users.length === 0) {
        setMsg('Invalid email or password');
        setLoading(false);
        return;
      }

      const user = users[0];

      if (pass === user.password) {
        login({
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
        });
        navigate('/dashboard');
      } else {
        setMsg('Invalid email or password');
      }
    } catch (e) {
      console.error(e);
      setMsg('Login failed');
    }

    setLoading(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <main
      className="main"
      style={{
        minHeight: '100vh',
        // keep bg1 as requested
        background: `url('../src/assets/images/bg1.jpg') no-repeat center center fixed`,
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        filter: 'brightness(0.95)',
        fontFamily: `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial`,
      }}
    >
      {/* Outer shell identical to your HTML structure so CSS applies */}
      <div id="login-screen" style={{ width: '100%' }}>
        {/* Force the two-column layout and spacing so placement matches the screenshot */}
        <div
          className="wrap"
          style={{
            display: 'flex',
            gap: 56,
            padding: '48px 80px',
            alignItems: 'center',
            minHeight: '100vh',
            boxSizing: 'border-box',
            justifyContent: 'space-between',
          }}
        >
          {/* HERO (left) */}
          <div
            className="hero"
            aria-hidden="false"
            style={{
              width: '58%',
              padding: '18px 28px',
              boxSizing: 'border-box',
            }}
          >
            <div className="brand-row" style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 10 }}>
              <img
                src="../src/assets/images/tupehrlogo.jpg"
                alt="TUP EHR Logo"
                className="brand-logo"
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'contain', padding: 8 }}
              />
              <div>
                <h1 style={{
                  margin: 0,
                  fontSize: 34,
                  lineHeight: 1.05,
                  fontWeight: 900,
                  fontFamily: `"Merriweather", serif`,
                  color: '#111',
                  letterSpacing: '-0.4px',
                }}>
                  Technological University of the
                  <br />
                  Philippines (TUP) Manila – Clinic
                </h1>
              </div>
            </div>

            <p className="lead" style={{
              marginTop: 22,
              color: 'rgba(68,68,68,1)',
              maxWidth: 760,
              fontSize: 17,
              lineHeight: 1.9,
              fontWeight: 400,
              opacity: 0.95,
              textAlign: 'justify',
              textJustify: 'inter-word'
            }}>
              TUP-M Electronic Health Records System is a streamlined, modern electronic health
              record platform designed to support efficient, accurate, and student-centered
              clinical care. It centralizes patient information, simplifies consultation
              documentation, improves workflow for clinicians, and ensures secure, role-based
              access to medical records — all tailored to the needs of the Technological
              University of the Philippines community.
            </p>

            <div
  className="tagline"
  style={{
    marginTop: 26,
    fontStyle: 'italic',
    color: '#333',
    fontSize: 15,
    textAlign: 'center',
    width: '100%'
  }}
>
  “Where records don’t get lost—just students.”
</div>

          </div>

          {/* LOGIN (right) */}
          <div
            className="login-wrap"
            aria-hidden="false"
            style={{
              width: '40%',
              display: 'flex',
              justifyContent: 'flex-start',
            }}
          >
            <div
              className="login-card"
              role="form"
              aria-labelledby="login-title"
              style={{
                width: 460,
                background: 'linear-gradient(180deg, #931b1b, #b92a2a)',
                color: '#fff',
                padding: 32,
                borderRadius: 28,
                boxShadow: '0 20px 50px rgba(0,0,0,0.14)',
                boxSizing: 'border-box',
              }}
            >
              <h2 id="login-title" style={{
                textAlign: 'center',
                margin: '6px 0 14px 0',
                fontSize: 28,
                fontWeight: 800,
                fontFamily: `"Merriweather", serif`
              }}>Log In</h2>

              <div className="field" style={{ margin: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="email" style={{ fontSize: 13, color: 'rgba(255,255,255,0.95)', fontWeight: 600 }}>Email</label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  placeholder="you@tup.edu.ph"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={onKeyDown}
                  style={{
                    background: 'rgba(255,255,255,0.94)',
                    border: 'none',
                    padding: '11px 12px',
                    borderRadius: 10,
                    fontSize: 14,
                    color: '#111',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.04)',
                  }}
                />
              </div>

              <div className="field" style={{ margin: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="password" style={{ fontSize: 13, color: 'rgba(255,255,255,0.95)', fontWeight: 600 }}>Password</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  onKeyDown={onKeyDown}
                  style={{
                    background: 'rgba(255,255,255,0.94)',
                    border: 'none',
                    padding: '11px 12px',
                    borderRadius: 10,
                    fontSize: 14,
                    color: '#111',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.04)',
                  }}
                />
              </div>

              <div className="actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <button
                  className="link"
                  id="forgot"
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  style={{
                    color: 'rgba(255,255,255,0.95)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    fontSize: 13,
                    padding: 0
                  }}
                >
                  Forgot Password
                </button>

                <button
                  id="loginBtn"
                  className="btn"
                  onClick={handleLogin}
                  disabled={loading}
                  style={{
                    background: '#fff',
                    color: '#931b1b',
                    fontWeight: 700,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 6px 14px rgba(0,0,0,0.08)',
                    fontSize: 14
                  }}
                >
                  {loading ? 'Signing in…' : 'Log In'}
                </button>
              </div>

              {msg && (
                <div id="login-msg" style={{ marginTop: 12, color: 'var(--danger)' }}>
                  {msg}
                </div>
              )}

              <div className="footer-note" style={{ marginTop: 14, color: 'rgba(255,255,255,0.92)', textAlign: 'center', fontSize: 12.5 }}>
                © Technological University of the Philippines
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Login;
