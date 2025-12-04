import express from 'express';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;
if (!RECAPTCHA_SECRET) {
  console.error("Missing RECAPTCHA_SECRET in .env");
  process.exit(1);
}

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/auth/verify-captcha', verifyLimiter, async (req, res) => {
  const token = req.body?.token;
  if (!token) return res.status(400).json({ error: 'Missing captcha token' });

  try {
    const googleRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET,
        response: token,
      }),
    });

    const data = await googleRes.json();

    // Accept when Google says success AND (for v3) score is above threshold
    if (!data.success) return res.status(400).json({ error: 'Captcha failed' });

    // Optional: check v3 score (tune threshold as needed; 0.3 is common, you saw 0.9 for dev)
    const MIN_SCORE = 0.3;
    if (typeof data.score === 'number' && data.score < MIN_SCORE) {
      return res.status(400).json({ error: 'Captcha score too low' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Captcha server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✔ Captcha server running on port ${PORT}`);
});
