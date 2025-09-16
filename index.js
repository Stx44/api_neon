import express from 'express';
import cors from 'cors';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();
app.use(cors());
app.use(express.json());

// Configuração do Banco de Dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// =================================================================
// 🧑 ROTAS DE USUÁRIOS (SEM CRIPTOGRAFIA - NÃO RECOMENDADO)
// =================================================================

app.post('/usuarios', async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ success: false, error: "Nome, email e senha são obrigatórios." });
  }
  try {
    const result = await pool.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email, criado_em',
      [nome, email, senha]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ success: false, error: "Email e senha são obrigatórios." });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND senha = $2',
      [email, senha]
    );
    if (result.rows.length > 0) {
      const usuario = result.rows[0];
      delete usuario.senha;
      res.json({ success: true, data: usuario });
    } else {
      res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }
  } catch (error) {
    console.error("Erro ao fazer login:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

// =================================================================
// 🍽️ ROTAS DE ALIMENTAÇÃO
// =================================================================

app.post('/alimentacao', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;
  if (!usuario_id || !descricao || !data_agendada) {
    return res.status(400).json({ success: false, error: "Dados incompletos." });
  }
  try {
    const result = await pool.query(
      'INSERT INTO alimentacao (usuario_id, descricao, data_agendada) VALUES ($1, $2, $3) RETURNING *',
      [usuario_id, descricao, data_agendada]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Erro ao criar registro de alimentação:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

app.get('/alimentacao/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  if (!usuario_id) {
    return res.status(400).json({ success: false, error: "ID do usuário não fornecido." });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM alimentacao WHERE usuario_id = $1',
      [usuario_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Erro ao buscar alimentação:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

app.put('/alimentacao/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: "ID do registro não fornecido." });
  }
  try {
    const result = await pool.query(
      'UPDATE alimentacao SET concluido = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Registro de alimentação não encontrado." });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Erro ao atualizar alimentação:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

// =================================================================
// 🏋️ ROTAS DE EXERCÍCIOS
// =================================================================

app.post('/exercicios', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;
  if (!usuario_id || !descricao || !data_agendada) {
    return res.status(400).json({ success: false, error: "Dados incompletos." });
  }
  try {
    const result = await pool.query(
      'INSERT INTO exercicios (usuario_id, descricao, data_agendada) VALUES ($1, $2, $3) RETURNING *',
      [usuario_id, descricao, data_agendada]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Erro ao criar exercício:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

app.get('/exercicios/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  if (!usuario_id) {
    return res.status(400).json({ success: false, error: "ID do usuário não fornecido." });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM exercicios WHERE usuario_id = $1',
      [usuario_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Erro ao buscar exercícios:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

app.put('/exercicios/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: "ID do exercício não fornecido." });
  }
  try {
    const result = await pool.query(
      'UPDATE exercicios SET concluido = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Exercício não encontrado." });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Erro ao atualizar exercício:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});


// =================================================================
// ✅ ROTAS DE METAS E REGISTROS
// =================================================================

app.post('/metas', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;
  if (!usuario_id || !descricao || !data_agendada) {
    return res.status(400).json({ success: false, error: "Dados incompletos para salvar a meta." });
  }
  try {
    const dataInicioSemana = new Date(data_agendada);
    dataInicioSemana.setDate(dataInicioSemana.getDate() - dataInicioSemana.getDay());
    dataInicioSemana.setHours(0, 0, 0, 0);

    const result = await pool.query(
      `INSERT INTO metas (usuario_id, descricao, data_agendada, concluido) VALUES ($1, $2, $3, FALSE) RETURNING *;`,
      [usuario_id, descricao, dataInicioSemana]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar meta:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

app.get('/metas/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  if (!usuario_id) {
    return res.status(400).json({ success: false, error: "ID do usuário não fornecido." });
  }
  try {
    const result = await pool.query(
      `SELECT * FROM metas WHERE usuario_id = $1 ORDER BY data_agendada ASC;`,
      [usuario_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Erro na rota /metas/:usuario_id:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

app.put('/metas/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: "ID da meta não fornecido." });
  }
  try {
    const result = await pool.query(
      `UPDATE metas SET concluido = TRUE WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Meta não encontrada." });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Erro ao marcar meta como concluída:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

app.post('/dashboard/peso', async (req, res) => {
  const { usuario_id, peso, data_registro } = req.body;
  if (!usuario_id || !peso || !data_registro) {
    return res.status(400).json({ success: false, error: "Dados incompletos." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO pesagem (usuario_id, peso, data_registro) VALUES ($1, $2, $3) RETURNING *;`,
      [usuario_id, peso, data_registro]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar peso:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});


// =================================================================
// 📊 ROTAS DE DASHBOARDS (LEITURA)
// =================================================================

app.get('/dashboard/ranking', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.nome,
        SUM(CASE WHEN e.concluido = TRUE THEN 10 ELSE 0 END) AS pontos_exercicios,
        SUM(CASE WHEN p.id IS NOT NULL THEN 5 ELSE 0 END) AS pontos_pesagem,
        (SUM(CASE WHEN e.concluido = TRUE THEN 10 ELSE 0 END) + SUM(CASE WHEN p.id IS NOT NULL THEN 5 ELSE 0 END)) AS pontos
      FROM 
        usuarios u
      LEFT JOIN 
        exercicios e ON u.id = e.usuario_id
      LEFT JOIN 
        pesagem p ON u.id = p.usuario_id
      GROUP BY 
        u.id, u.nome
      ORDER BY 
        pontos DESC
      LIMIT 10;
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Erro na rota /dashboard/ranking:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

app.get('/dashboard/evolucao-peso/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  if (!usuario_id) {
    return res.status(400).json({ success: false, error: "ID do usuário não fornecido." });
  }
  try {
    const result = await pool.query(
      `SELECT peso, data_registro FROM pesagem WHERE usuario_id = $1 ORDER BY data_registro ASC;`,
      [usuario_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Erro na rota /dashboard/evolucao-peso:", error);
    res.status(500).json({ success: false, error: "Erro interno do servidor." });
  }
});

app.get('/dashboard/exercicios', async (req, res) => {
    const { usuario_id } = req.query;
    if (!usuario_id) {
        return res.status(400).json({ success: false, error: "ID do usuário não fornecido." });
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
        res.json({ success: true, data: result.rows });
    } catch (error) {
       console.error("Erro na rota /dashboard/exercicios:", error);
       res.status(500).json({ success: false, error: "Erro interno do servidor." });
    }
});


// =================================================================
// INICIALIZAÇÃO DO SERVIDOR
// =================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));