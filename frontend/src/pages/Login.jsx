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
      // Query the users table for the email
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

      // Check plain text password
      if (pass === user.password) {
        // Login success
        login({ id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role });
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

  return (
    <main className="main">
      <section className="page" style={{ maxWidth: '420px', margin: '40px auto' }}>
        <div className="card">
          <h2>Sign in</h2>
          <p style={{ color: 'var(--muted)' }}>Welcome back — sign in to continue.</p>

          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              id="login-email"
              className="input"
              type="text"
              placeholder="Your name or email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              id="login-pass"
              className="input"
              type="password"
              placeholder="Password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button id="loginBtn" className="btn" onClick={handleLogin}>Sign in</button>
            </div>
            {msg && <div id="login-msg" style={{ color: 'var(--danger)' }}>{msg}</div>}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
