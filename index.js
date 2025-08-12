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
  const { nome, email } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO usuarios (nome, email) VALUES ($1, $2) RETURNING *",
      [nome, email]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao inserir usuário" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
