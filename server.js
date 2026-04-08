/* ═══════════════════════════════════════════
   Mini AI — Backend Server (Node.js + Express)
   
   FREE AI API: OpenRouter (free tier)
   Sign up at: https://openrouter.ai
   Get your free API key (no credit card needed)
   Add it to the .env file as OPENROUTER_API_KEY
═══════════════════════════════════════════ */

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────
app.use(cors());
app.use(express.json({ limit: '4mb' }));

// Serve frontend files
app.use(express.static(path.join(__dirname)));

// ── Config ────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// Free models available on OpenRouter:
// - "meta-llama/llama-3.1-8b-instruct:free"  (recommended, fast)
// - "mistralai/mistral-7b-instruct:free"
// - "google/gemma-2-9b-it:free"
// - "microsoft/phi-3-mini-128k-instruct:free"
const FREE_MODEL = 'meta-llama/llama-3-8b-instruct';

const SYSTEM_PROMPT = `You are Mini AI, a friendly and knowledgeable student assistant. 
Your goal is to help students learn, understand concepts, and complete their work.

Guidelines:
- Be clear, accurate, and educational in your explanations
- Use examples to illustrate difficult concepts
- Break down complex topics step by step
- Be encouraging and supportive
- Use markdown formatting for code, lists, and headers when helpful
- Keep answers focused and concise unless detail is needed
- If you don't know something, say so honestly`;

// ── POST /chat ────────────────────────────
app.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  // Validate input
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (message.trim().length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: 'Message is too long (max 4000 chars).' });
  }

  // API key check
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: 'OpenRouter API key not configured. Please add OPENROUTER_API_KEY to your .env file.'
    });
  }

  // Build messages array (with conversation context)
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    // Include prior conversation history (skip the last message since we add it separately)
    ...history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-8)  // last 8 exchanges for context
      .map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message.trim() }
  ];

  try {
    // Call OpenRouter free API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',  // Required by OpenRouter
        'X-Title': 'Mini AI Student Assistant',   // Optional, shows in OpenRouter dashboard
      },
      body: JSON.stringify({
        model: FREE_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
        stream: false,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData?.error?.message || `OpenRouter API error: ${response.status}`;
      
      // Friendly messages for common errors
      if (response.status === 401) throw new Error('Invalid API key. Check your OPENROUTER_API_KEY in .env');
      if (response.status === 429) throw new Error('Rate limit hit. Please wait a moment and try again.');
      if (response.status === 402) throw new Error('API quota exceeded. Try a different free model.');
      throw new Error(msg);
    }

    const data = await response.json();

    // Extract the AI reply
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) throw new Error('No response from AI. Please try again.');

    console.log(`[${new Date().toLocaleTimeString()}] ✓ Response sent (${reply.length} chars)`);
    res.json({ reply: reply.trim() });

  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    res.status(500).json({ error: err.message || 'Something went wrong. Please try again.' });
  }
});

// ── Health check ──────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    model: FREE_MODEL,
    apiKeySet: !!OPENROUTER_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// ── Fallback: serve index.html for any route ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start Server ──────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║     Mini AI Server Started 🚀         ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  URL:   http://localhost:${PORT}`);
  console.log(`  Model: ${FREE_MODEL}`);
  console.log(`  API Key: ${OPENROUTER_API_KEY ? '✓ Set' : '✗ Not set — add to .env!'}`);
  console.log('');
  if (!OPENROUTER_API_KEY) {
    console.log('  ⚠️  WARNING: No API key found!');
    console.log('     1. Sign up at https://openrouter.ai (free)');
    console.log('     2. Get your API key');
    console.log('     3. Add it to .env: OPENROUTER_API_KEY=sk-or-...\n');
  }
});
