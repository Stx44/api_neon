const express = require("express");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.use(express.json());

// Conexão com o banco Neon
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_DxFV26ahLUAH@ep-red-term-aczhrzl6-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: { rejectUnauthorized: false }
});

// Rota inicial
app.get("/", (req, res) => {
  res.send("API conectada ao banco Neon 🚀");
});

// Listar usuários
app.get("/usuarios", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM usuarios");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

// Adicionar usuário
app.post("/usuarios", async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: "Nome, email e senha são obrigatórios." });
  }

  try {
    const result = await pool.query(
      "INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING *",
      [nome, email, senha]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao inserir usuário" });
  }
});


// Login de usuário (sem bcrypt)
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE email = $1 AND senha = $2",
      [email, senha]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "E-mail ou senha inválidos" });
    }

    const usuario = result.rows[0];
    res.json({
      message: "Login realizado com sucesso!",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no login" });
  }
});

// Keep-alive para evitar que o NeonDB durma
setInterval(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("Ping no banco para evitar inatividade");
  } catch (err) {
    console.error("Erro no keep-alive:", err);
  }
}, 4 * 60 * 1000); // a cada 4 minutos

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
