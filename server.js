const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = "chave_super_secreta_do_caio"; // Chave de segurança para as "pulseiras"

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SUA CHAVE DE ACESSO DO MONGODB (Já configurada!)
const uri = "mongodb+srv://caiomozeika_db_user:Cm873400@cluster0.kungptq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

let db, tasksCol, usersCol;

// Função que conecta o servidor à nuvem
async function connectDB() {
    try {
        await client.connect();
        console.log("🟢 Conectado à Nuvem (MongoDB)"); // Essa é a frase que queremos ver no Render!
        
        db = client.db('MeuOrganizador');
        tasksCol = db.collection('tarefas');
        usersCol = db.collection('usuarios');
    } catch (e) { 
        console.error("🔴 Erro ao conectar no MongoDB:", e); 
    }
}
connectDB();

// --- SISTEMA DE LOGIN E CADASTRO ---

// Rota para cadastrar um novo usuário
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Verifica se o e-mail já existe
        const userExists = await usersCol.findOne({ email });
        if (userExists) return res.status(400).json({ message: "E-mail já cadastrado!" });

        // Criptografa a senha (embaralha) antes de salvar
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await usersCol.insertOne({ email, password: hashedPassword });
        res.json({ message: "Usuário criado com sucesso!" });
    } catch (error) {
        res.status(500).json({ message: "Erro ao criar usuário." });
    }
});

// Rota para entrar no sistema
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Procura o usuário
        const user = await usersCol.findOne({ email });
        
        // Se não achar o usuário OU a senha não bater
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "E-mail ou senha incorretos!" });
        }
        
        // Se deu tudo certo, cria a "pulseira" de acesso (Token)
        const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: '7d' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: "Erro ao fazer login." });
    }
});

// Middleware de Segurança: O "Segurança da Balada" que verifica a pulseira
const auth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: "Acesso negado!" });
    
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.userId; // Carimba o ID do usuário na requisição
        next(); // Deixa passar
    } catch { 
        res.status(401).json({ message: "Sessão expirada. Faça login novamente!" }); 
    }
};

// --- ROTAS DE TAREFAS (AGORA PROTEGIDAS) ---

// Buscar tarefas (Apenas as do usuário logado)
app.get('/api/tasks', auth, async (req, res) => {
    try {
        const tasks = await tasksCol.find({ ownerId: req.userId }, { projection: { _id: 0 } }).toArray();
        res.json(tasks);
    } catch (error) {
        res.status(500).send("Erro ao buscar tarefas.");
    }
});

// Salvar tarefas (Salva com o ID do usuário logado)
app.post('/api/tasks', auth, async (req, res) => {
    try {
        // Pega as tarefas e carimba o dono em cada uma
        const tasks = req.body.map(t => ({ ...t, ownerId: req.userId }));
        
        // Apaga as tarefas antigas apenas deste usuário
        await tasksCol.deleteMany({ ownerId: req.userId });
        
        // Salva a lista nova
        if (tasks.length > 0) {
            await tasksCol.insertMany(tasks);
        }
        
        res.json({ message: "Sincronizado na nuvem com sucesso!" });
    } catch (error) {
        res.status(500).send("Erro ao salvar tarefas.");
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
