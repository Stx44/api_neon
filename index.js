import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import nodemailer from 'nodemailer'; // 📧 Para envio de e-mails
import crypto from 'crypto'; // Para gerar tokens

const app = express();
app.use(cors());
// Limite aumentado para 50mb para aceitar fotos em Base64
app.use(express.json({ limit: '50mb' })); 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ----------------------------------------------------------------------
// 📧 CONFIGURAÇÃO DO EMAIL (TENTATIVA FINAL: PORTA 587 - TLS)
// ----------------------------------------------------------------------
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',  // Servidor SMTP do Gmail
    port: 587,               // Porta ALTERNATIVA para TLS
    secure: false,           // 'secure: false' para a porta 587
    requireTLS: true,        // Força o uso de criptografia TLS
    auth: {
        user: 'PlusHealthTcc@gmail.com', 
        // ⚠️ SUBSTITUA O '+health123' PELA SUA SENHA DE APLICAÇÃO DE 16 CARACTERES SEM ESPAÇOS
        pass: '+health123' 
    },
    connectionTimeout: 5000, // 5 segundos para estabelecer a conexão
    socketTimeout: 5000      // 5 segundos para inatividade do socket
});

// Define o domínio da sua API no Render (usado no link de verificação)
const API_URL_DOMAIN = "https://api-neon-2kpd.onrender.com"; 

// ----------------------------------------------------------------------
// 🧑 GESTÃO DE USUÁRIOS (Auth, Perfil, Senhas, Verificação)
// ----------------------------------------------------------------------

// 1. Criar Conta (Cadastro) - AGORA REQUER VERIFICAÇÃO DE EMAIL
app.post('/usuarios', async (req, res) => {
    const { nome, email, senha } = req.body;
    const token = crypto.randomBytes(20).toString('hex'); // Gera um token único

    try {
        const result = await pool.query(
            'INSERT INTO usuarios (nome, email, senha, email_verificado, verification_token) VALUES ($1, $2, $3, FALSE, $4) RETURNING id, nome, email',
            [nome, email, senha, token]
        );
        
        const novoUsuario = result.rows[0];

        // --- Envio do Email de Confirmação ---
        const mailOptions = {
            to: email,
            subject: '🥳 Confirme o seu email - Acesso ao seu App!',
            html: `
                   <p style="font-size: 16px;">Olá <strong>${nome}</strong>,</p>
                   <p>Agradecemos por se registar! Por favor, clique no botão abaixo para verificar o seu endereço de email e ativar a sua conta.</p>
                   <a href="${API_URL_DOMAIN}/verificar-email?token=${token}" 
                      style="display: inline-block; padding: 10px 20px; background-color: #005067; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0;">
                       Ativar Minha Conta
                   </a>
                   <p style="margin-top: 30px; font-size: 12px; color: #888; border-top: 1px solid #f0f0f0; padding-top: 10px;">
                       <strong>Cláusula de Segurança:</strong> Se você não se registou em nossa plataforma, por favor, desconsidere este e-mail. Para sua segurança, recomendamos que troque sua senha imediatamente caso tenha alguma dúvida sobre a segurança da sua conta.
                   </p>
                  `
        };
        
        // 🚨 LOG DE RASTREIO APLICADO
        console.log('##### Tentando enviar email para:', email); 

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erro ao enviar email:', error);
            } else {
                console.log('Email enviado: ' + info.response);
            }
        });

        res.json({ sucesso: true, mensagem: "Conta criada. Verifique o seu email para ativar.", usuario: novoUsuario });

    } catch (err) {
        // 🚨 Log de erro do DB ou validação
        console.error('Erro no cadastro/DB:', err.message);
        res.status(500).json({ erro: err.message });
    }
});

// 2. Login - AGORA SÓ FUNCIONA COM EMAIL VERIFICADO
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1 AND senha = $2',
            [email, senha]
        );
        
        const usuario = result.rows[0];

        if (!usuario) {
            return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas' });
        }
        
        if (usuario.email_verificado === false) {
             return res.status(401).json({ sucesso: false, mensagem: 'Conta não verificada. Por favor, verifique o seu email.' });
        }
        
        res.json({ sucesso: true, usuario: usuario });
        
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

// ----------------------------------------------------------------------
// 🔐 RECUPERAÇÃO DE SENHA (Esqueci a Senha) & VERIFICAÇÃO
// ----------------------------------------------------------------------

// 5. Verificar se Email existe (Primeira tela do fluxo de recuperação)
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

// 6. Redefinir Senha (Segunda tela do fluxo de recuperação)
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

// 7. Finalizar Verificação por Token (Acionado pelo link do email)
app.get('/verificar-email', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).send('Token de verificação não encontrado.');
    }

    try {
        const result = await pool.query(
            'UPDATE usuarios SET email_verificado = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING id',
            [token]
        );

        if (result.rowCount > 0) {
            return res.send('<h1>✅ Sucesso!</h1><p>O seu e-mail foi verificado com sucesso. Pode fechar esta janela e voltar à aplicação para fazer login.</p>');
        } else {
            return res.status(400).send('Link de verificação inválido ou expirado.');
        }

    } catch (err) {
        res.status(500).send('Erro interno do servidor durante a verificação.');
    }
});

// ----------------------------------------------------------------------
// 🍽️ ROTAS DE ALIMENTAÇÃO (EXISTENTES)
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// 🏋️ ROTAS DE EXERCÍCIOS (EXISTENTES)
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// 📊 ROTAS DE DASHBOARDS & METAS (EXISTENTES)
// ----------------------------------------------------------------------

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

// Metas do Dashboard
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

// Salvar Meta
app.post('/metas', async (req, res) => {
  const { usuario_id, descricao, data_agendada } = req.body;

  if (!usuario_id || !descricao || !data_agendada) {
    return res.status(400).json({ sucesso: false, erro: "Dados incompletos." });
  }

  try {
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

// Marcar Meta como concluída
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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));