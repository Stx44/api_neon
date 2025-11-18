import 'dotenv/config'; // Carrega variáveis locais se existirem (não atrapalha no Render)
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import nodemailer from 'nodemailer'; 
import crypto from 'crypto'; 

const app = express();
app.use(cors());
// Limite aumentado para 50mb para aceitar fotos em Base64
app.use(express.json({ limit: '50mb' })); 

// Conexão com o Banco de Dados (Pega a URL definida no Render ou local)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ----------------------------------------------------------------------
// 📧 CONFIGURAÇÃO DO EMAIL (USANDO SUA VARIÁVEL DO RENDER)
// ----------------------------------------------------------------------
const transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 2525,
    secure: false,
    requireTLS: true,
    auth: {
        user: 'apikey', 
        pass: process.env.SENDGRID_API_KEY, 
    },
    connectionTimeout: 5000, 
    socketTimeout: 5000      
});

// Define o domínio da sua API no Render
const API_URL_DOMAIN = "https://api-neon-2kpd.onrender.com"; 

// ----------------------------------------------------------------------
// 🧑 GESTÃO DE USUÁRIOS
// ----------------------------------------------------------------------

// 1. Criar Conta (Cadastro)
app.post('/usuarios', async (req, res) => {
    const { nome, email, senha } = req.body;
    const token = crypto.randomBytes(20).toString('hex');

    try {
        const result = await pool.query(
            'INSERT INTO usuarios (nome, email, senha, email_verificado, verification_token) VALUES ($1, $2, $3, FALSE, $4) RETURNING id, nome, email',
            [nome, email, senha, token]
        );
        
        const novoUsuario = result.rows[0];

        // --- Envio do Email ---
        const mailOptions = {
            from: '"Plus Health" <PlusHealthTcc@gmail.com>', // Este email DEVE ser o verificado no SendGrid
            replyTo: 'PlusHealthTcc@gmail.com',
            to: email,
            subject: '🥳 Confirme o seu email - Acesso ao seu App!',
            html: `
                   <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                     <h2 style="color: #005067;">Bem-vindo, ${nome}!</h2>
                     <p>Obrigado por se cadastrar. Para garantir a segurança da sua conta, clique no botão abaixo:</p>
                     <br>
                     <a href="${API_URL_DOMAIN}/verificar-email?token=${token}" 
                        style="background-color: #005067; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                         Confirmar Meu Email
                     </a>
                     <br><br>
                     <p style="color: #777; font-size: 12px;">Se você não criou esta conta, ignore este email.</p>
                   </div>
                  `
        };
        
        console.log('##### Enviando email para:', email); 

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erro no envio (SendGrid):', error);
            } else {
                console.log('Email enviado com sucesso:', info.response);
            }
        });

        res.json({ sucesso: true, mensagem: "Conta criada! Verifique seu email.", usuario: novoUsuario });

    } catch (err) {
        console.error('Erro ao cadastrar:', err.message);
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
        
        const usuario = result.rows[0];

        if (!usuario) {
            return res.status(401).json({ sucesso: false, mensagem: 'Email ou senha incorretos.' });
        }
        
        if (usuario.email_verificado === false) {
             return res.status(401).json({ sucesso: false, mensagem: 'Verifique seu email antes de entrar.' });
        }
        
        res.json({ sucesso: true, usuario: usuario });
        
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// 3. Atualizar Perfil
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
    res.status(500).json({ erro: err.message });
  }
});

// 4. Alterar Senha
app.put('/usuarios/:id/senha', async (req, res) => {
  const { id } = req.params;
  const { senha_atual, nova_senha } = req.body;

  if (!senha_atual || !nova_senha) return res.status(400).json({ erro: "Dados incompletos." });

  try {
    const userResult = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    const usuario = userResult.rows[0];

    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
    if (usuario.senha !== senha_atual) return res.status(401).json({ erro: "Senha atual incorreta." });

    await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [nova_senha, id]);
    res.json({ sucesso: true, mensagem: "Senha alterada!" });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 5. Recuperação de Senha (Verificar Email)
app.post('/verificar-email', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT id, nome FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      res.json({ sucesso: true, usuario: result.rows[0] });
    } else {
      res.status(404).json({ sucesso: false, erro: 'Email não cadastrado.' });
    }
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 6. Redefinir Senha
app.put('/redefinir-senha/:id', async (req, res) => {
  const { id } = req.params;
  const { nova_senha } = req.body;

  if (!nova_senha) return res.status(400).json({ erro: "Nova senha obrigatória." });

  try {
    const result = await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2 RETURNING id', [nova_senha, id]);
    if (result.rowCount > 0) {
      res.json({ sucesso: true, mensagem: "Senha redefinida!" });
    } else {
      res.status(404).json({ erro: "Usuário não encontrado." });
    }
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// 7. Rota do Link de Verificação (Navegador)
app.get('/verificar-email', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token inválido.');

    try {
        const result = await pool.query(
            'UPDATE usuarios SET email_verificado = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING id',
            [token]
        );

        if (result.rowCount > 0) {
            // HTML bonito de confirmação
            res.send(`
                <div style="text-align: center; font-family: Arial; margin-top: 50px;">
                    <h1 style="color: green;">✅ Email Verificado!</h1>
                    <p>Sua conta foi ativada com sucesso.</p>
                    <p>Você já pode fechar esta janela e fazer login no aplicativo.</p>
                </div>
            `);
        } else {
            res.status(400).send('<h1 style="color: red;">Link inválido ou expirado.</h1>');
        }
    } catch (err) {
        res.status(500).send('Erro interno no servidor.');
    }
});

// --- Rotas Dashboard/App ---
app.post('/alimentacao', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;
  try {
    const result = await pool.query('INSERT INTO alimentacao (usuario_id, descricao, data_agendada) VALUES ($1, $2, $3) RETURNING *', [usuario_id, descricao, data_agendada]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/alimentacao/:usuario_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM alimentacao WHERE usuario_id = $1', [req.params.usuario_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.put('/alimentacao/:id', async (req, res) => {
  try {
    const result = await pool.query('UPDATE alimentacao SET concluido = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/exercicios', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;
  try {
    const result = await pool.query('INSERT INTO exercicios (usuario_id, descricao, data_agendada) VALUES ($1, $2, $3) RETURNING *', [usuario_id, descricao, data_agendada]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/exercicios/:usuario_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exercicios WHERE usuario_id = $1', [req.params.usuario_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.put('/exercicios/:id', async (req, res) => {
  try {
    const result = await pool.query('UPDATE exercicios SET concluido = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/dashboard/exercicio/concluido', async (req, res) => {
  const { usuario_id, nome_exercicio, data } = req.body;
  try {
    const result = await pool.query(`INSERT INTO exercicios (usuario_id, descricao, data_agendada, concluido) VALUES ($1, $2, $3, TRUE) RETURNING *;`, [usuario_id, nome_exercicio, data]);
    res.json({ sucesso: true, dado: result.rows[0] });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/dashboard/peso', async (req, res) => {
  const { usuario_id, peso, data_registro } = req.body;
  try {
    const result = await pool.query(`INSERT INTO pesagem (usuario_id, peso, data_registro) VALUES ($1, $2, $3) RETURNING *;`, [usuario_id, peso, data_registro]);
    res.json({ sucesso: true, dado: result.rows[0] });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/dashboard/evolucao-peso/:usuario_id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT peso, data_registro FROM pesagem WHERE usuario_id = $1 ORDER BY data_registro ASC;`, [req.params.usuario_id]);
    res.json({ sucesso: true, evolucao_peso: result.rows });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/dashboard/metas/:usuario_id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, descricao, data_agendada, concluido FROM metas WHERE usuario_id = $1 ORDER BY data_agendada ASC;`, [req.params.usuario_id]);
    res.json({ sucesso: true, metas: result.rows });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/dashboard/ranking', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.nome,
        SUM(CASE WHEN e.concluido = TRUE THEN 10 ELSE 0 END) AS pontos_exercicios,
        SUM(CASE WHEN p.id IS NOT NULL THEN 5 ELSE 0 END) AS pontos_pesagem,
        (SUM(CASE WHEN e.concluido = TRUE THEN 10 ELSE 0 END) + SUM(CASE WHEN p.id IS NOT NULL THEN 5 ELSE 0 END)) AS pontos
      FROM usuarios u
      LEFT JOIN exercicios e ON u.id = e.usuario_id
      LEFT JOIN pesagem p ON u.id = p.usuario_id
      GROUP BY u.id ORDER BY pontos DESC LIMIT 10;
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/metas', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;
  try {
    const dataInicioSemana = new Date(data_agendada);
    dataInicioSemana.setDate(dataInicioSemana.getDate() - dataInicioSemana.getDay());
    dataInicioSemana.setHours(0, 0, 0, 0);
    const result = await pool.query(`INSERT INTO metas (usuario_id, descricao, data_agendada, concluido) VALUES ($1, $2, $3, FALSE) RETURNING *;`, [usuario_id, descricao, dataInicioSemana]);
    res.status(201).json({ sucesso: true, meta: result.rows[0] });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.put('/metas/:id', async (req, res) => {
  try {
    const result = await pool.query(`UPDATE metas SET concluido = TRUE WHERE id = $1 RETURNING *`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ sucesso: false, erro: "Meta não encontrada." });
    res.json({ sucesso: true, meta: result.rows[0] });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/metas/:usuario_id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM metas WHERE usuario_id = $1 ORDER BY data_agendada ASC;`, [req.params.usuario_id]);
    res.json({ sucesso: true, metas: result.rows });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// Porta do servidor (Render define process.env.PORT automaticamente)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));