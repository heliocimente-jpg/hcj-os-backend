const express = require('express');
const fetch = require('node-fetch');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Fila simples por organização (ver explicação completa na versão anterior do README) —
// evita que vários utilizadores da mesma empresa rebentem o rate-limit da Groq ao mesmo tempo.
const queues = new Map();
function enqueue(orgId, task) {
  const prev = queues.get(orgId) || Promise.resolve();
  const next = prev.then(task, task);
  queues.set(orgId, next);
  return next;
}

router.post('/generate', async (req, res) => {
  const { messages, maxTokens, temperature } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages é obrigatório (array de {role, content}).' });
  }
  try {
    const orgResult = await pool.query('SELECT * FROM organizations WHERE id=$1', [req.user.org]);
    const org = orgResult.rows[0];
    if (!org || !org.groq_api_key) {
      return res.status(400).json({ error: 'Esta organização ainda não configurou a chave Groq. Um administrador deve configurá-la em PUT /api/ai/orgs/:id/groq-key.' });
    }

    const content = await enqueue(req.user.org, async () => {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + org.groq_api_key },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: temperature ?? 0.3,
          max_tokens: maxTokens || 2800
        })
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error?.message || `Groq respondeu ${r.status}`);
      }
      const d = await r.json();
      return d.choices?.[0]?.message?.content || '';
    });
    res.json({ content });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Falha ao contactar a Groq: ' + e.message });
  }
});

// Admin da organização define/actualiza a chave Groq — guardada só no servidor/Supabase.
router.put('/orgs/:id/groq-key', async (req, res) => {
  if (Number(req.params.id) !== req.user.org) return res.status(403).json({ error: 'Sem permissão.' });
  if (req.user.permission !== 'admin') return res.status(403).json({ error: 'Só um administrador pode alterar a chave Groq.' });
  const { groqApiKey } = req.body || {};
  if (!groqApiKey || !groqApiKey.startsWith('gsk_')) return res.status(400).json({ error: 'Chave Groq inválida (deve começar por gsk_).' });
  try {
    await pool.query('UPDATE organizations SET groq_api_key=$1 WHERE id=$2', [groqApiKey, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao guardar a chave Groq.' });
  }
});

module.exports = router;
