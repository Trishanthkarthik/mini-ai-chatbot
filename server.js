/* ═══════════════════════════════════════════
   Mini AI — Backend Server (Render Ready)
═══════════════════════════════════════════ */

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 IMPORTANT for Render
app.set('trust proxy', 1);

// ── Middleware ────────────────────────────
app.use(cors());
app.use(express.json({ limit: '4mb' }));

// Serve frontend
app.use(express.static(path.join(__dirname)));

// ── Config ────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ✅ Stable model (no :free issues)
const MODEL = 'meta-llama/llama-3-8b-instruct';

const SYSTEM_PROMPT = `You are Mini AI, a helpful student assistant.
Explain clearly, give examples, and keep answers simple and useful.`;

// ── CHAT ROUTE ────────────────────────────
app.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'API key missing' });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-8),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        // 🔥 FIX FOR RENDER
        'HTTP-Referer': process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000',
        'X-Title': 'Mini AI'
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || 'API error');
    }

    const reply = data?.choices?.[0]?.message?.content || "No response";

    res.json({ reply });

  } catch (err) {
    console.error("ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── HEALTH CHECK ──────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── FRONTEND FALLBACK ─────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── START SERVER ──────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});