const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { signToken } = require('../middleware/auth');

const router = express.Router();

// Cria uma organização nova + o seu primeiro utilizador administrador.
router.post('/orgs/create', async (req, res) => {
  const { orgName, adminName, adminPin, inviteCode } = req.body || {};
  if (process.env.INVITE_CODE && inviteCode !== process.env.INVITE_CODE) {
    return res.status(403).json({ error: 'Código de convite inválido.' });
  }
  if (!orgName || !adminName || !adminPin) {
    return res.status(400).json({ error: 'orgName, adminName e adminPin são obrigatórios.' });
  }
  if (!/^\d{4}$/.test(adminPin)) {
    return res.status(400).json({ error: 'O PIN deve ter exactamente 4 dígitos.' });
  }
  try {
    const orgResult = await pool.query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
      [orgName]
    );
    const orgId = orgResult.rows[0].id;
    const pinHash = bcrypt.hashSync(adminPin, 10);
    const userResult = await pool.query(
      'INSERT INTO users (org_id, name, permission, pin_hash) VALUES ($1,$2,$3,$4) RETURNING id',
      [orgId, adminName, 'admin', pinHash]
    );
    const userRow = { id: userResult.rows[0].id, org_id: orgId, permission: 'admin', name: adminName };
    res.json({ token: signToken(userRow), org: { id: orgId, name: orgName }, user: userRow });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao criar organização.' });
  }
});

// Admin/gestor já autenticado adiciona um novo colega à MESMA organização.
router.post('/users/create', async (req, res) => {
  const { orgId, name, roleTitle, permission, pin } = req.body || {};
  if (!orgId || !name || !pin) return res.status(400).json({ error: 'orgId, name e pin são obrigatórios.' });
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'O PIN deve ter exactamente 4 dígitos.' });
  const validPerms = ['admin', 'manager', 'technician', 'viewer'];
  const perm = validPerms.includes(permission) ? permission : 'technician';
  try {
    const pinHash = bcrypt.hashSync(pin, 10);
    const result = await pool.query(
      'INSERT INTO users (org_id, name, role_title, permission, pin_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [orgId, name, roleTitle || '', perm, pinHash]
    );
    res.json({ id: result.rows[0].id, name, permission: perm });
  } catch (e) {
    if (e.code === '23505') { // unique_violation no Postgres
      return res.status(409).json({ error: 'Já existe um utilizador com este nome nesta organização.' });
    }
    console.error(e);
    res.status(500).json({ error: 'Erro ao criar utilizador.' });
  }
});

// Login: nome de utilizador + PIN + ID da organização.
router.post('/login', async (req, res) => {
  const { orgId, name, pin } = req.body || {};
  if (!orgId || !name || !pin) return res.status(400).json({ error: 'orgId, name e pin são obrigatórios.' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE org_id=$1 AND name=$2', [orgId, name]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(pin, user.pin_hash)) {
      return res.status(401).json({ error: 'Nome ou PIN incorrectos.' });
    }
    res.json({
      token: signToken(user),
      user: { id: user.id, name: user.name, permission: user.permission, org_id: user.org_id, lang: user.lang }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao processar login.' });
  }
});

module.exports = router;
