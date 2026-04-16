const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = "sua_chave_secreta_aqui"; // Pode deixar assim ou inventar uma senha maluca

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

// --- SISTEMA DE LOGIN E CADASTRO ---

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const userExists = await usersCol.findOne({ email });
    if (userExists) return res.status(400).json({ message: "E-mail já cadastrado!" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await usersCol.insertOne({ email, password: hashedPassword });
    res.json({ message: "Usuário criado com sucesso!" });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await usersCol.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "E-mail ou senha incorretos!" });
    }
    const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: '7d' });
    res.json({ token });
});

// Segurança: verifica a "pulseira" (token)
const auth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: "Acesso negado!" });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.userId;
        next();
    } catch { res.status(401).json({ message: "Sessão expirada!" }); }
};

// --- ROTAS DE TAREFAS (PROTEGIDAS) ---

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
