import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../AuthContext.jsx';

const Signup = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [role, setRole] = useState('user');
  const [avatar, setAvatar] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !pass) {
      setMsg('Please fill required fields.');
      return;
    }
    setLoading(true);
    setMsg('');

    try {
      // Check if user already exists
      const { data: existingUsers } = await supabase
        .from('users')
        .select('email')
        .eq('email', email);

      if (existingUsers && existingUsers.length > 0) {
        setMsg('User already exists.');
        setLoading(false);
        return;
      }

      // Insert new user with plain text password
      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            name,
            email,
            password: pass,
            role,
            avatar: avatar || null
          }
        ])
        .select();

      if (error) {
        console.error(error);
        setMsg('Signup failed');
        setLoading(false);
        return;
      }

      // Auto login the new user
      const user = data[0];
      login({ id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role });
      navigate('/dashboard');

    } catch (e) {
      console.error(e);
      setMsg('Signup failed');
    }
    setLoading(false);
  };

  const gotoLogin = () => {
    navigate('/login');
  };

  return (
    <main className="main">
      <section className="page" style={{ maxWidth: '480px', margin: '40px auto' }}>
        <div className="card">
          <h2>Create account</h2>
          <p style={{ color: 'var(--muted)' }}>Create a demo account (client-side only).</p>

          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              id="su-name"
              className="input"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              id="su-email"
              className="input"
              type="email"
              placeholder="Email (or username)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              id="su-pass"
              className="input"
              type="password"
              placeholder="Password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            <label style={{ fontSize: '13px', color: 'var(--muted)' }}>Avatar (optional):</label>
            <input
              id="su-avatar"
              type="text"
              className="input"
              placeholder="URL path to avatar image (optional)"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button id="signupBtn" className="btn" onClick={handleSignup}>Create account</button>
              <button id="gotoLogin" className="btn secondary" onClick={gotoLogin}>Back to sign in</button>
            </div>
            {msg && <div id="signup-msg" style={{ color: 'var(--muted)', fontSize: '13px' }}>{msg}</div>}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Signup;
