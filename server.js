const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // Nosso carteiro!

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = "chave_super_secreta_do_caio";

// --- CONFIGURAÇÃO DO E-MAIL ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'caiomozeika@gmail.com', // ⚠️ COLOQUE SEU EMAIL DO GMAIL AQUI
        pass: 'ctas unqx mypm zqgj'     // ⚠️ COLOQUE AQUELA SENHA DE 16 LETRAS AQUI (SEM ESPAÇOS)
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const uri = "mongodb+srv://caiomozeika_db_user:Cm873400@cluster0.kungptq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

let db, tasksCol, usersCol;

async function connectDB() {
    try {
        await client.connect();
        console.log("🟢 Conectado à Nuvem (MongoDB)");
        db = client.db('MeuOrganizador');
        tasksCol = db.collection('tarefas');
        usersCol = db.collection('usuarios');
    } catch (e) { console.error("🔴 Erro DB:", e); }
}
connectDB();

// --- SISTEMA DE CADASTRO E LOGIN (MANTIDO) ---
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (await usersCol.findOne({ email })) return res.status(400).json({ message: "E-mail já cadastrado!" });
        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCol.insertOne({ email, password: hashedPassword });
        res.json({ message: "Usuário criado com sucesso!" });
    } catch (e) { res.status(500).json({ message: "Erro ao criar." }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await usersCol.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: "E-mail ou senha incorretos!" });
        const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token });
    } catch (e) { res.status(500).json({ message: "Erro no login." }); }
});

// --- NOVO: ESQUECI A SENHA E RECUPERAÇÃO ---

// 1. Rota que gera o link e manda o e-mail
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await usersCol.findOne({ email });
    if (!user) return res.status(404).json({ message: "E-mail não encontrado no sistema!" });

    // Cria um "ticket" válido por 15 minutos
    const resetToken = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: '15m' });
    const resetLink = `https://organizador-tarefas.onrender.com/?resetToken=${resetToken}`;

    const mailOptions = {
        from: 'Meu Organizador',
        to: email,
        subject: 'Recuperação de Senha - Meu Organizador',
        html: `<h3>Você pediu para redefinir sua senha!</h3>
               <p>Clique no link abaixo para criar uma senha nova. Esse link expira em 15 minutos.</p>
               <a href="${resetLink}" style="padding:10px 15px; background:#3182ce; color:white; text-decoration:none; border-radius:5px; display:inline-block; margin-top:10px;">Criar Nova Senha</a>
               <p style="margin-top:20px; font-size:11px; color:#888;">Se não foi você, apenas ignore este e-mail.</p>`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: "E-mail de recuperação enviado! Olhe sua caixa de entrada." });
    } catch (error) {
        console.error("Erro ao enviar e-mail:", error);
        res.status(500).json({ message: "Erro ao enviar o e-mail." });
    }
});

// 2. Rota que salva a nova senha
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const decoded = jwt.verify(token, SECRET_KEY); // Verifica se o link é válido
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await usersCol.updateOne(
            { _id: new ObjectId(decoded.userId) },
            { $set: { password: hashedPassword } }
        );
        res.json({ message: "Senha alterada com sucesso! Redirecionando..." });
    } catch (error) { res.status(400).json({ message: "Link inválido ou expirado!" }); }
});

// --- ROTAS PROTEGIDAS (MANTIDO) ---
const auth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: "Acesso negado!" });
    try { req.userId = jwt.verify(token, SECRET_KEY).userId; next(); } 
    catch { res.status(401).json({ message: "Sessão expirada!" }); }
};

app.get('/api/tasks', auth, async (req, res) => {
    const tasks = await tasksCol.find({ ownerId: req.userId }, { projection: { _id: 0 } }).toArray();
    res.json(tasks);
});

app.post('/api/tasks', auth, async (req, res) => {
    const tasks = req.body.map(t => ({ ...t, ownerId: req.userId }));
    await tasksCol.deleteMany({ ownerId: req.userId });
    if (tasks.length > 0) await tasksCol.insertMany(tasks);
    res.json({ message: "Sincronizado!" });
});

app.listen(port, () => console.log(`🚀 Rodando na porta ${port}`));
