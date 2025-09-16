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

// 🏋️ Exercícios
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

// ✅ Rota para marcar exercício como concluído (usada no dashboard)
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
    console.error("Erro ao inserir exercício concluído:", error);
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// ✅ Rota para salvar um registro de peso
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
    console.error("Erro ao salvar peso:", error);
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// ✅ Rota para salvar uma meta (corrigida)
app.post('/metas', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;
  
  if (!usuario_id || !descricao || !data_agendada) {
    return res.status(400).json({ sucesso: false, erro: "Dados incompletos para salvar a meta." });
  }

  try {
    // 🟢 CORREÇÃO: Ajusta a data para o início da semana
    const dataInicioSemana = new Date(data_agendada);
    dataInicioSemana.setDate(dataInicioSemana.getDate() - dataInicioSemana.getDay());
    dataInicioSemana.setHours(0, 0, 0, 0);

    const result = await pool.query(
      `INSERT INTO metas (usuario_id, descricao, data_agendada, concluido) VALUES ($1, $2, $3, FALSE) RETURNING *;`,
      [usuario_id, descricao, dataInicioSemana]
    );
    
    res.status(201).json({ sucesso: true, meta: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar meta:", error);
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// ✅ NOVO: Rota para marcar meta como concluída
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
        console.error("Erro ao marcar meta como concluída:", error);
        res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
    }
});

// ✅ NOVA ROTA: Obter a lista completa de metas de um usuário
app.get('/metas/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM metas WHERE usuario_id = $1 ORDER BY data_agendada ASC;`,
      [usuario_id]
    );
    res.json({ sucesso: true, metas: result.rows });
  } catch (error) {
    console.error("Erro na rota /metas/:usuario_id:", error);
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});


// 📊 Dashboards
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

// ✅ Rota para o Ranking
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
    console.error("Erro na rota /dashboard/ranking:", error);
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// ✅ Rota para as Metas (Corrigida para retornar a lista completa)
app.get('/dashboard/metas/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, descricao, data_agendada, concluido FROM metas WHERE usuario_id = $1 ORDER BY data_agendada ASC;`,
      [usuario_id]
    );

    // ✅ Mapeia o resultado e converte 'concluido' para um booleano real
    const metasTratadas = result.rows.map(meta => ({
      ...meta,
      concluido: meta.concluido === true // ou `meta.concluido === 'TRUE'` dependendo da representação
    }));

    res.json({ sucesso: true, metas: metasTratadas });
  } catch (error) {
    console.error("Erro na rota /dashboard/metas:", error);
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

// ✅ Rota para a Evolução do Peso (Corrigida)
app.get('/dashboard/evolucao-peso/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT peso, data_registro FROM pesagem WHERE usuario_id = $1 ORDER BY data_registro ASC;`,
      [usuario_id]
    );
    res.json({ sucesso: true, evolucao_peso: result.rows });
    
  } catch (error) {
    console.error("Erro na rota /dashboard/evolucao-peso:", error);
    res.status(500).json({ sucesso: false, erro: "Erro interno do servidor." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));