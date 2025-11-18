import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors());
// Aumentamos o limite para 50mb para aceitar fotos em Base64
app.use(express.json({ limit: '50mb' })); 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==================================================
// 🧑 GESTÃO DE USUÁRIOS (Auth, Perfil, Senhas)
// ==================================================

// 1. Criar Conta (Cadastro)
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

// 2. Login
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

// 3. Atualizar Perfil (Foto, Nome, Email)
app.put('/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { foto_perfil, nome, email } = req.body;

  try {
    const result = await pool.query(
      `UPDATE usuarios 
       SET foto_perfil = COALESCE($1, foto_perfil),
           nome = COALESCE($2, nome),
           email = COALESCE($3, email)
       WHERE id = $4 
       RETURNING *`,
      [foto_perfil, nome, email, id]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ erro: 'Usuário não encontrado' });
    }
  } catch (err) {
    console.error("Erro ao atualizar usuário:", err);
    res.status(500).json({ erro: err.message });
  }
});

// 4. Alterar Senha (Estando Logado - Exige senha atual)
app.put('/usuarios/:id/senha', async (req, res) => {
  const { id } = req.params;
  const { senha_atual, nova_senha } = req.body;

  if (!senha_atual || !nova_senha) {
    return res.status(400).json({ erro: "Informe a senha atual e a nova senha." });
  }

  try {
    const userResult = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    const usuario = userResult.rows[0];

    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

    if (usuario.senha !== senha_atual) {
      return res.status(401).json({ erro: "Senha atual incorreta." });
    }

    await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [nova_senha, id]);
    res.json({ sucesso: true, mensagem: "Senha alterada com sucesso!" });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ==================================================
// 🔐 RECUPERAÇÃO DE SENHA (Esqueci a Senha)
// ==================================================

// 5. Verificar se Email existe
app.post('/verificar-email', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT id, nome FROM usuarios WHERE email = $1', [email]);
    
    if (result.rows.length > 0) {
      res.json({ sucesso: true, usuario: result.rows[0] });
    } else {
      res.status(404).json({ sucesso: false, erro: 'Email não encontrado.' });
    }
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 6. Redefinir Senha (Sem senha antiga)
app.put('/redefinir-senha/:id', async (req, res) => {
  const { id } = req.params;
  const { nova_senha } = req.body;

  if (!nova_senha) {
    return res.status(400).json({ erro: "A nova senha é obrigatória." });
  }

  try {
    const result = await pool.query(
      'UPDATE usuarios SET senha = $1 WHERE id = $2 RETURNING id',
      [nova_senha, id]
    );
    
    if (result.rowCount > 0) {
      res.json({ sucesso: true, mensagem: "Senha redefinida com sucesso!" });
    } else {
      res.status(404).json({ erro: "Usuário não encontrado." });
    }
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ==================================================
// 🍽️ ROTAS DE ALIMENTAÇÃO
// ==================================================

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

// ==================================================
// 🏋️ ROTAS DE EXERCÍCIOS
// ==================================================

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

// Marca exercício como concluído (Dashboard)
app.post('/dashboard/exercicio/concluido', async (req, res) => {
  const { usuario_id, nome_exercicio, data } = req.body;
  if (!usuario_id || !nome_exercicio || !data) {
    return res.status(400).json({ sucesso: false, erro: "Dados incompletos." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO exercicios (usuario_id, descricao, data_agendada, concluido) VALUES ($1, $2, $3, TRUE) RETURNING *;`,
      [usuario_id, nome_exercicio, data]
    );
    res.json({ sucesso: true, dado: result.rows[0] });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// ==================================================
// 🎯 ROTAS DE METAS
// ==================================================

app.post('/metas', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;

  if (!usuario_id || !descricao || !data_agendada) {
    return res.status(400).json({ sucesso: false, erro: "Dados incompletos." });
  }

  try {
    // Ajusta data para inicio da semana
    const dataInicioSemana = new Date(data_agendada);
    dataInicioSemana.setDate(dataInicioSemana.getDate() - dataInicioSemana.getDay());
    dataInicioSemana.setHours(0, 0, 0, 0);

    const result = await pool.query(
      `INSERT INTO metas (usuario_id, descricao, data_agendada, concluido) VALUES ($1, $2, $3, FALSE) RETURNING *;`,
      [usuario_id, descricao, dataInicioSemana]
    );

    res.status(201).json({ sucesso: true, meta: result.rows[0] });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

app.put('/metas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE metas SET concluido = TRUE WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ sucesso: false, erro: "Meta não encontrada." });
    }
    res.json({ sucesso: true, meta: result.rows[0] });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

app.get('/metas/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM metas WHERE usuario_id = $1 ORDER BY data_agendada ASC;`,
      [usuario_id]
    );
    res.json({ sucesso: true, metas: result.rows });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// ==================================================
// 📊 DASHBOARDS & ESTATÍSTICAS
// ==================================================

// Salvar Peso
app.post('/dashboard/peso', async (req, res) => {
  const { usuario_id, peso, data_registro } = req.body;
  if (!usuario_id || !peso || !data_registro) {
    return res.status(400).json({ sucesso: false, erro: "Dados incompletos." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO pesagem (usuario_id, peso, data_registro) VALUES ($1, $2, $3) RETURNING *;`,
      [usuario_id, peso, data_registro]
    );
    res.json({ sucesso: true, dado: result.rows[0] });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// Histórico de Peso
app.get('/dashboard/peso', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ sucesso: false, erro: "ID obrigatório." });

  try {
    const result = await pool.query(
      'SELECT data_registro, peso FROM pesagem WHERE usuario_id = $1 ORDER BY data_registro ASC;',
      [usuario_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// Evolução de Peso
app.get('/dashboard/evolucao-peso/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT peso, data_registro FROM pesagem WHERE usuario_id = $1 ORDER BY data_registro ASC;`,
      [usuario_id]
    );
    res.json({ sucesso: true, evolucao_peso: result.rows });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// Estatística de Exercícios
app.get('/dashboard/exercicios', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ sucesso: false, erro: "ID obrigatório." });

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
    res.status(500).json({ erro: err.message });
  }
});

// Metas para Dashboard
app.get('/dashboard/metas/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, descricao, data_agendada, concluido FROM metas WHERE usuario_id = $1 ORDER BY data_agendada ASC;`,
      [usuario_id]
    );
    res.json({ sucesso: true, metas: result.rows });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// Ranking Geral
app.get('/dashboard/ranking', async (req, res) => {
  try {
    const result = await pool.query(`
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
        u.id
      ORDER BY 
        pontos DESC
      LIMIT 10;
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));