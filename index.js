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
// Adiciona uma nova tarefa de alimentação
app.post('/alimentacao', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO alimentacao (usuario_id, descricao, data_agendada) VALUES ($1, $2, $3) RETURNING *',
      [usuario_id, descricao, data_agendada]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ✅ CORRIGIDO: Busca todas as tarefas de alimentação de um usuário
// O ID agora é passado na query, assim como no dashboard
app.get('/alimentacao', async (req, res) => {
  const { usuario_id } = req.query;
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

// ✅ CORRIGIDO: Marca uma tarefa de alimentação como concluída
app.put('/alimentacao/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE alimentacao SET concluido = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 🏋️ Exercícios
// Adiciona uma nova tarefa de exercício
app.post('/exercicios', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO exercicios (usuario_id, descricao, data_agendada) VALUES ($1, $2, $3) RETURNING *',
      [usuario_id, descricao, data_agendada]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ✅ CORRIGIDO: Busca todas as tarefas de exercícios de um usuário
// O ID agora é passado na query, assim como no dashboard
app.get('/exercicios', async (req, res) => {
  const { usuario_id } = req.query;
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

// Marca uma tarefa de exercício como concluída
app.put('/exercicios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE exercicios SET concluido = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 📊 Dashboards
// ✅ CORRIGIDO: Retorna os dados para o dashboard de peso/IMC
app.get('/dashboard/peso', async (req, res) => {
  const { usuario_id } = req.query;

  if (!usuario_id) {
    return res.status(400).json({ sucesso: false, erro: "ID do usuário não fornecido." });
  }

  try {
    const result = await pool.query(
      'SELECT data_registro, peso FROM pesagem WHERE usuario_id = $1 ORDER BY data_registro ASC;',
      [usuario_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro na rota /dashboard/peso:", error);
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// ✅ CORRIGIDO: Retorna os dados para o dashboard de exercícios
app.get('/dashboard/exercicios', async (req, res) => {
  const { usuario_id } = req.query;

  if (!usuario_id) {
    return res.status(400).json({ sucesso: false, erro: "ID do usuário não fornecido." });
  }

  try {
    const result = await pool.query(
      `SELECT COUNT(id) AS total_concluido, data_agendada
       FROM exercicios
       WHERE usuario_id = $1 AND concluido = TRUE
       GROUP BY data_agendada
       ORDER BY data_agendada ASC`,
      [usuario_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Erro na rota /dashboard/exercicios:", err);
    res.status(500).json({ erro: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));