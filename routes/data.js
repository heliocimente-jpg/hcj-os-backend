const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // tudo neste ficheiro exige sessão válida

async function logAudit(orgId, userId, action, details) {
  await pool.query(
    'INSERT INTO audit_log (org_id,user_id,action,details) VALUES ($1,$2,$3,$4)',
    [orgId, userId, action, details || '']
  );
}

// ---------- CASOS ----------
// Todos os utilizadores da mesma organização veem os MESMOS casos —
// guardados numa única base de dados Postgres partilhada.
router.get('/cases', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cases WHERE org_id=$1 ORDER BY created_at DESC',
      [req.user.org]
    );
    res.json(result.rows.map(r => ({ ...r, data: r.data_json || {} })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar casos.' });
  }
});

router.post('/cases', async (req, res) => {
  const { caseCode, client, sector, service, riskHse, priority, data } = req.body || {};
  try {
    const result = await pool.query(
      `INSERT INTO cases (org_id, case_code, client, sector, service, risk_hse, priority, technician_id, data_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [req.user.org, caseCode || 'HCJ-000', client || '', sector || '', service || '', riskHse || '', priority || '', req.user.uid, JSON.stringify(data || {})]
    );
    await logAudit(req.user.org, req.user.uid, 'Caso criado', caseCode);
    res.json({ id: result.rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao criar caso.' });
  }
});

router.put('/cases/:id', async (req, res) => {
  try {
    const existingResult = await pool.query('SELECT * FROM cases WHERE id=$1 AND org_id=$2', [req.params.id, req.user.org]);
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: 'Caso não encontrado nesta organização.' });

    const { client, sector, service, riskHse, priority, status, data } = req.body || {};
    await pool.query(
      `UPDATE cases SET client=$1, sector=$2, service=$3, risk_hse=$4, priority=$5, status=$6, data_json=$7, updated_at=now() WHERE id=$8`,
      [
        client ?? existing.client, sector ?? existing.sector, service ?? existing.service,
        riskHse ?? existing.risk_hse, priority ?? existing.priority, status ?? existing.status,
        data ? JSON.stringify(data) : existing.data_json, req.params.id
      ]
    );
    await logAudit(req.user.org, req.user.uid, 'Caso actualizado', existing.case_code);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao actualizar caso.' });
  }
});

// ---------- RELATÓRIOS ----------
router.get('/reports', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports WHERE org_id=$1 ORDER BY created_at DESC', [req.user.org]);
    res.json(result.rows.map(r => ({ ...r, content: r.content_json || {} })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar relatórios.' });
  }
});

router.post('/reports', async (req, res) => {
  const { caseId, caseCode, client, reportType, lang, content, isDraftUnverified } = req.body || {};
  try {
    const result = await pool.query(
      `INSERT INTO reports (org_id, case_id, case_code, client, report_type, lang, content_json, is_draft_unverified, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [req.user.org, caseId || null, caseCode || '', client || '', reportType || 'hse', lang || 'pt', JSON.stringify(content || {}), !!isDraftUnverified, req.user.uid]
    );
    await logAudit(req.user.org, req.user.uid, 'Relatório gerado', caseCode);
    res.json({ id: result.rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao guardar relatório.' });
  }
});

// ---------- EQUIPA (apenas gestores/admin veem a lista completa) ----------
router.get('/team', requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, role_title, permission, lang, created_at FROM users WHERE org_id=$1',
      [req.user.org]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar equipa.' });
  }
});

// ---------- AUDITORIA ----------
router.get('/audit', requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM audit_log WHERE org_id=$1 ORDER BY created_at DESC LIMIT 500',
      [req.user.org]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao listar auditoria.' });
  }
});

module.exports = router;
