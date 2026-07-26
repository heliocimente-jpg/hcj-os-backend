require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initSchema } = require('./db');

const app = express();
app.use(cors()); // em produção, restringe ao domínio do teu frontend: cors({origin:'https://...'})
app.use(express.json({ limit: '15mb' }));

app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'HCJ-OS Backend', db: 'postgres', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/data'));
app.use('/api/ai', require('./routes/ai'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3001;

// Cria as tabelas (se ainda não existirem) antes de aceitar pedidos —
// evita o erro clássico de "tabela não existe" no primeiro arranque.
initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`HCJ-OS backend (Postgres/Supabase) a correr na porta ${PORT}`));
  })
  .catch(err => {
    console.error('Falha ao inicializar a base de dados:', err.message);
    process.exit(1);
  });
