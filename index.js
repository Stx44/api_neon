import 'dotenv/config'; 
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

// Conexão com o Banco de Dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ----------------------------------------------------------------------
// 📧 CONFIGURAÇÃO DO EMAIL
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
            from: '"Plus Health" <PlusHealthTcc@gmail.com>', 
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

// 7. Rota do Link de Verificação (Navegador - Ativação de Conta)
// --- TELA ESTILIZADA COM CARINHO ---
app.get('/verificar-email', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token inválido.');

    try {
        const result = await pool.query(
            'UPDATE usuarios SET email_verificado = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING nome',
            [token]
        );

        if (result.rowCount > 0) {
            const nome = result.rows[0].nome;

            // HTML Estilizado de Boas-Vindas
            res.send(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Conta Verificada</title>
                    <style>
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            background-color: #f4f9f9;
                            color: #333;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            padding: 20px;
                        }
                        .card {
                            background: white;
                            padding: 40px;
                            border-radius: 20px;
                            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                            max-width: 500px;
                            text-align: center;
                            border-top: 5px solid #005067;
                        }
                        h1 {
                            color: #005067;
                            font-size: 24px;
                            margin-bottom: 10px;
                        }
                        p {
                            font-size: 16px;
                            line-height: 1.6;
                            color: #666;
                            margin-bottom: 20px;
                        }
                        .icon {
                            font-size: 50px;
                            margin-bottom: 20px;
                            color: #005067;
                        }
                        .footer {
                            font-size: 12px;
                            color: #999;
                            margin-top: 30px;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon">✨</div>
                        <h1>Que alegria ter você aqui, ${nome}!</h1>
                        
                        <p>Seu e-mail foi confirmado com sucesso e sua conta está ativada.</p>
                        
                        <p>Estamos muito felizes em fazer parte da sua jornada. Lembre-se: cada pequeno passo conta e nós estaremos torcendo por você em cada conquista.</p>
                        
                        <p>Agora, respire fundo e prepare-se para cuidar da pessoa mais importante da sua vida: você.</p>

                        <p style="font-size: 14px; color: #888;">Pode fechar esta tela e voltar para o aplicativo.</p>

                        <div class="footer">
                            Com carinho,<br>
                            Equipe Plus Health
                        </div>
                    </div>
                </body>
                </html>
            `);
        } else {
            // Caso de erro (link expirado)
            res.status(400).send(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Link Expirado</title>
                    <style>
                        body { font-family: sans-serif; background-color: #f4f9f9; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                        .card { background: white; padding: 40px; border-radius: 20px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                        h1 { color: #d9534f; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Link inválido ou expirado.</h1>
                        <p>Tente solicitar um novo link ou entre em contato com o suporte.</p>
                    </div>
                </body>
                </html>
            `);
        }
    } catch (err) {
        res.status(500).send('Erro interno no servidor.');
    }
});

// 8. Verificar status do usuário (Logout automático ao deletar)
app.get('/usuarios/:id/status', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT id FROM usuarios WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            res.json({ ativo: true });
        } else {
            res.status(404).json({ ativo: false });
        }
    } catch (err) {
        res.status(500).json({ erro: err.message });
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

// ----------------------------------------------------------------------
// 🗑️ EXCLUSÃO DE CONTA (ROTAS FINAIS)
// ----------------------------------------------------------------------

// 9. Solicitar Exclusão de Conta (Envia Email)
app.post('/usuarios/:id/solicitar-exclusao', async (req, res) => {
    const { id } = req.params;
    const { email } = req.body; 
    
    const token = crypto.randomBytes(20).toString('hex');

    try {
        // Define o token de verificação
        const result = await pool.query(
            'UPDATE usuarios SET verification_token = $1 WHERE id = $2 RETURNING nome',
            [token, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }

        const nome = result.rows[0].nome;

        // Email com mensagem de confirmação
        const mailOptions = {
            from: '"Plus Health" <PlusHealthTcc@gmail.com>',
            replyTo: 'PlusHealthTcc@gmail.com',
            to: email,
            subject: '⚠️ Confirmação de Exclusão de Conta',
            html: `
                   <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ccc; padding: 20px; border-radius: 10px;">
                     <h2 style="color: #d9534f;">Atenção, ${nome}!</h2>
                     <p>Recebemos uma solicitação para <strong>EXCLUIR PERMANENTEMENTE</strong> sua conta.</p>
                     <p>Se foi você quem solicitou, clique no botão abaixo para confirmar.</p>
                     <br>
                     <a href="${API_URL_DOMAIN}/confirmar-exclusao?token=${token}" 
                        style="background-color: #d9534f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                         Sim, Excluir Minha Conta
                     </a>
                     <br><br>
                     <p style="color: #777; font-size: 12px;">Se não foi você, ignore este email.</p>
                   </div>
                  `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erro ao enviar email de exclusão:', error);
                return res.status(500).json({ erro: "Erro ao enviar email." });
            }
            res.json({ sucesso: true, mensagem: "Email de confirmação enviado." });
        });

    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// 10. Confirmar Exclusão (Link do Email - Tela de Despedida)
app.get('/confirmar-exclusao', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token inválido.');

    try {
        const userCheck = await pool.query('SELECT id, nome FROM usuarios WHERE verification_token = $1', [token]);
        
        if (userCheck.rowCount === 0) {
            return res.status(400).send('<h1 style="color: red;">Link inválido ou já utilizado.</h1>');
        }

        const usuarioId = userCheck.rows[0].id;
        const nomeUsuario = userCheck.rows[0].nome;

        // Deleta tudo
        await pool.query('DELETE FROM alimentacao WHERE usuario_id = $1', [usuarioId]);
        await pool.query('DELETE FROM exercicios WHERE usuario_id = $1', [usuarioId]);
        await pool.query('DELETE FROM metas WHERE usuario_id = $1', [usuarioId]);
        await pool.query('DELETE FROM pesagem WHERE usuario_id = $1', [usuarioId]);
        await pool.query('DELETE FROM usuarios WHERE id = $1', [usuarioId]);

        // Página de Despedida Emocional
        res.send(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Conta Encerrada</title>
                <style>
                    body {
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                        background-color: #f4f9f9;
                        color: #333;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        padding: 20px;
                    }
                    .card {
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                        max-width: 500px;
                        text-align: center;
                        border-top: 5px solid #005067;
                    }
                    h1 {
                        color: #005067;
                        font-size: 24px;
                        margin-bottom: 10px;
                    }
                    p {
                        font-size: 16px;
                        line-height: 1.6;
                        color: #666;
                        margin-bottom: 20px;
                    }
                    .icon {
                        font-size: 50px;
                        margin-bottom: 20px;
                        color: #005067;
                    }
                    .footer {
                        font-size: 12px;
                        color: #999;
                        margin-top: 30px;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">🍃</div>
                    <h1>Foi uma honra, ${nomeUsuario}.</h1>
                    
                    <p>Sua conta foi excluída com sucesso e todos os seus dados foram apagados.</p>
                    
                    <p>Queremos que saiba que foi um privilégio fazer parte da sua jornada de saúde, mesmo que por pouco tempo. Cuidar de si mesmo é o maior ato de amor que existe.</p>
                    
                    <p>Continue se priorizando. Se um dia decidir voltar, nossas portas estarão sempre abertas para você.</p>

                    <div class="footer">
                        Com carinho,<br>
                        Equipe Plus Health
                    </div>
                </div>
            </body>
            </html>
        `);

    } catch (err) {
        console.error("Erro na exclusão:", err);
        res.status(500).send('Erro interno ao excluir conta.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));