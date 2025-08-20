import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 🧑 Usuários
app.post('/usuarios', async (req, res) => {
  const { nome, email, senha } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING *',
      [nome, email, senha]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 🔐 Login
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND senha = $2',
      [email, senha]
    );
    if (result.rows.length > 0) {
      res.json({ sucesso: true, usuario: result.rows[0] });
    } else {
      res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas' });
    }
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 🍽️ Alimentação
app.post('/alimentacao', async (req, res) => {
  const { usuario_id, tipo, calorias, data } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO alimentacao (usuario_id, tipo, calorias, data) VALUES ($1, $2, $3, $4) RETURNING *',
      [usuario_id, tipo, calorias, data]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/alimentacao/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM alimentacao WHERE usuario_id = $1',
      [usuario_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 🏋️ Exercícios
app.post('/exercicios', async (req, res) => {
  const { usuario_id, tipo, duracao, calorias, data } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO exercicios (usuario_id, tipo, duracao, calorias, data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [usuario_id, tipo, duracao, calorias, data]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/exercicios/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM exercicios WHERE usuario_id = $1',
      [usuario_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 📊 Progresso
app.get('/progresso/:usuario_id/:data', async (req, res) => {
  const { usuario_id, data } = req.params;
  try {
    const alimentacao = await pool.query(
      'SELECT SUM(calorias) AS total_calorias FROM alimentacao WHERE usuario_id = $1 AND data = $2',
      [usuario_id, data]
    );
    const exercicios = await pool.query(
      'SELECT SUM(calorias) AS total_gasto FROM exercicios WHERE usuario_id = $1 AND data = $2',
      [usuario_id, data]
    );
    res.json({
      data,
      calorias_consumidas: alimentacao.rows[0].total_calorias || 0,
      calorias_gastas: exercicios.rows[0].total_gasto || 0,
      saldo: (alimentacao.rows[0].total_calorias || 0) - (exercicios.rows[0].total_gasto || 0)
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
