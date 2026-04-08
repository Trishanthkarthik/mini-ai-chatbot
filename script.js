/* ═══════════════════════════════════════════
   Mini AI — Frontend Script
   Features:
   • Animated canvas background
   • Send messages to /chat backend
   • Render AI responses with basic Markdown
   • Chat history (localStorage)
   • Dark mode toggle
   • Typing indicator
   • Auto-resize textarea
   • Suggestion chips
   • Sidebar + mobile nav
═══════════════════════════════════════════ *

// ── 1. State ──────────────────────────────
let chatSessions = JSON.parse(localStorage.getItem('miniAI_sessions') || '[]');
let currentSession = null;        // { id, title, messages: [] }
let isLoading = false;

// ── 2. DOM Refs ───────────────────────────
const chatWindow      = document.getElementById('chatWindow');
const welcomeScreen   = document.getElementById('welcomeScreen');
const messagesEl      = document.getElementById('messages');
const msgInput        = document.getElementById('msgInput');
const sendBtn         = document.getElementById('sendBtn');
const historyList     = document.getElementById('historyList');
const newChatBtn      = document.getElementById('newChatBtn');
const newChatMobile   = document.getElementById('newChatMobile');
const themeToggle     = document.getElementById('themeToggle');
const themeLabel      = document.getElementById('themeLabel');
const sidebarOpen     = document.getElementById('sidebarOpen');
const sidebarClose    = document.getElementById('sidebarClose');
const sidebar         = document.getElementById('sidebar');

// ── 3. Init ───────────────────────────────
function init() {
  // restore dark mode preference
  const savedTheme = localStorage.getItem('miniAI_theme') || 'light';
  document.body.className = savedTheme;
  updateThemeLabel(savedTheme);

  startNewChat();
  renderHistory();
  initCanvas();
  setupEvents();
}

// ── 4. Chat Sessions ──────────────────────
function startNewChat() {
  currentSession = { id: Date.now(), title: 'New Chat', messages: [] };
  renderMessages();
  showWelcome(true);
  markActiveHistory();
  // deselect in sidebar
  document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
}

function saveCurrentSession() {
  if (!currentSession || currentSession.messages.length === 0) return;

  // Use first user message as title
  const firstUser = currentSession.messages.find(m => m.role === 'user');
  if (firstUser) {
    currentSession.title = firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '…' : '');
  }

  // Upsert
  const idx = chatSessions.findIndex(s => s.id === currentSession.id);
  if (idx >= 0) {
    chatSessions[idx] = currentSession;
  } else {
    chatSessions.unshift(currentSession);
  }

  // Keep max 20 sessions
  if (chatSessions.length > 20) chatSessions = chatSessions.slice(0, 20);
  localStorage.setItem('miniAI_sessions', JSON.stringify(chatSessions));
  renderHistory();
}

function loadSession(id) {
  const session = chatSessions.find(s => s.id === id);
  if (!session) return;
  currentSession = JSON.parse(JSON.stringify(session)); // deep copy
  renderMessages();
  showWelcome(currentSession.messages.length === 0);
  markActiveHistory();
  closeSidebarMobile();
}

function markActiveHistory() {
  document.querySelectorAll('.history-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.id) === currentSession?.id);
  });
}

// ── 5. Render History Sidebar ─────────────
function renderHistory() {
  historyList.innerHTML = '';
  if (chatSessions.length === 0) {
    historyList.innerHTML = '<li style="padding:8px 18px;font-size:0.82rem;color:var(--text-muted)">No chats yet</li>';
    return;
  }
  chatSessions.forEach(s => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.dataset.id = s.id;
    li.title = s.title;
    li.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ${escapeHtml(s.title)}
    `;
    if (currentSession && s.id === currentSession.id) li.classList.add('active');
    li.addEventListener('click', () => loadSession(s.id));
    historyList.appendChild(li);
  });
}

// ── 6. Render Messages ────────────────────
function renderMessages() {
  messagesEl.innerHTML = '';
  if (!currentSession) return;
  currentSession.messages.forEach(msg => appendBubble(msg.role, msg.content, false));
}

function appendBubble(role, content, animate = true) {
  showWelcome(false);

  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  if (!animate) row.style.animation = 'none';

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}-avatar`;
  avatar.textContent = role === 'ai' ? 'AI' : 'You';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'ai' ? renderMarkdown(content) : `<p>${escapeHtml(content)}</p>`;

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);

  scrollToBottom();
  return row;
}

function showTypingIndicator() {
  showWelcome(false);
  const row = document.createElement('div');
  row.className = 'message-row ai';
  row.id = 'typing-row';

  const avatar = document.createElement('div');
  avatar.className = 'avatar ai-avatar';
  avatar.textContent = 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'bubble typing-indicator';
  bubble.innerHTML = '<span></span><span></span><span></span>';

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function removeTypingIndicator() {
  document.getElementById('typing-row')?.remove();
}

// ── 7. Send Message ───────────────────────
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || isLoading) return;

  isLoading = true;
  setUILoading(true);
  msgInput.value = '';
  autoResize();

  // Add user message to state & DOM
  currentSession.messages.push({ role: 'user', content: text });
  appendBubble('user', text);

  showTypingIndicator();

  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: currentSession.messages.slice(-10) // send last 10 messages for context
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Server error' }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.reply || 'Sorry, I could not generate a response.';

    removeTypingIndicator();
    currentSession.messages.push({ role: 'assistant', content: aiText });
    appendBubble('ai', aiText);
    saveCurrentSession();

  } catch (err) {
    removeTypingIndicator();
    const errMsg = err.message.includes('Failed to fetch')
      ? 'Cannot reach the server. Make sure server.js is running on port 3000.'
      : err.message;

    showError(errMsg);
    // Append error bubble
    appendBubble('ai', `⚠️ ${errMsg}`);
    // Remove failed user message from state
    currentSession.messages.pop();
  } finally {
    isLoading = false;
    setUILoading(false);
    msgInput.focus();
  }
}

function setUILoading(loading) {
  sendBtn.disabled = loading;
  msgInput.disabled = loading;
  sendBtn.style.opacity = loading ? '0.6' : '';
}

// ── 8. Markdown Renderer (light) ──────────
function renderMarkdown(text) {
  let html = escapeHtml(text);

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code (`...`)
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Bold (**...**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic (*...*)
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // Headers (## and #)
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;margin:12px 0 4px">$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2 style="font-size:1.1rem;font-weight:600;margin:14px 0 6px">$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1 style="font-size:1.2rem;font-weight:700;margin:16px 0 8px">$1</h1>');

  // Unordered lists
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Line breaks → paragraphs
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<') ) return p; // already a block element
    return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('');

  return html;
}

// ── 9. Helpers ────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scrollToBottom() {
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
}

function showWelcome(show) {
  welcomeScreen.style.display = show ? '' : 'none';
}

function showError(msg) {
  let toast = document.querySelector('.error-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'error-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function autoResize() {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 150) + 'px';
}

// ── 10. Dark Mode ─────────────────────────
function toggleTheme() {
  const isDark = document.body.classList.contains('dark');
  const next = isDark ? 'light' : 'dark';
  document.body.className = next;
  localStorage.setItem('miniAI_theme', next);
  updateThemeLabel(next);
}

function updateThemeLabel(theme) {
  themeLabel.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
}

// ── 11. Mobile Sidebar ────────────────────
function openSidebarMobile() {
  sidebar.classList.add('open');
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeSidebarMobile);
  }
  overlay.classList.add('show');
}

function closeSidebarMobile() {
  sidebar.classList.remove('open');
  document.querySelector('.sidebar-overlay')?.classList.remove('show');
}

// ── 12. Event Listeners ───────────────────
function setupEvents() {
  // Send
  sendBtn.addEventListener('click', sendMessage);

  // Enter to send (Shift+Enter for newline)
  msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  msgInput.addEventListener('input', autoResize);

  // New chat
  newChatBtn.addEventListener('click', startNewChat);
  newChatMobile.addEventListener('click', () => { startNewChat(); closeSidebarMobile(); });

  // Theme
  themeToggle.addEventListener('click', toggleTheme);

  // Sidebar mobile
  sidebarOpen.addEventListener('click', openSidebarMobile);
  sidebarClose.addEventListener('click', closeSidebarMobile);

  // Suggestion chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      msgInput.value = chip.dataset.prompt;
      autoResize();
      sendMessage();
    });
  });
}

// ── 13. Animated Background Canvas ───────
function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', () => { resize(); createParticles(); });

  // Soft floating orbs / particles
  function createParticles() {
    particles = Array.from({ length: 28 }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      r:  Math.random() * 180 + 60,
      dx: (Math.random() - 0.5) * 0.25,
      dy: (Math.random() - 0.5) * 0.25,
      hue: Math.random() > 0.5 ? 254 : 320, // indigo or pink
      alpha: Math.random() * 0.12 + 0.04,
    }));
  }
  createParticles();

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      const isDark = document.body.classList.contains('dark');
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      const base = isDark ? `hsla(${p.hue},70%,65%,${p.alpha})` : `hsla(${p.hue},80%,70%,${p.alpha})`;
      grad.addColorStop(0, base);
      grad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      p.x += p.dx;
      p.y += p.dy;
      if (p.x < -p.r) p.x = W + p.r;
      if (p.x > W + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = H + p.r;
      if (p.y > H + p.r) p.y = -p.r;
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ── 14. Boot ──────────────────────────────
init();
