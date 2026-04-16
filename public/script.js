const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb'); // Nova ferramenta de banco de dados!
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// A SUA CHAVE MESTRA DA NUVEM (Já com a sua senha!)
const uri = "mongodb+srv://caiomozeika_db_user:Cm873400@cluster0.kungptq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

let collection;

// Função para conectar no seu banco de dados
async function connectDB() {
    try {
        await client.connect();
        console.log("🟢 Conectado à Nuvem (MongoDB) com sucesso!");
        
        // Ele vai criar um banco chamado "MeuOrganizador" e uma gaveta chamada "tarefas"
        const database = client.db('MeuOrganizador');
        collection = database.collection('tarefas');
    } catch (error) {
        console.error("🔴 Erro ao conectar no MongoDB:", error);
    }
}
connectDB();

// ROTA GET: Busca as tarefas na nuvem quando a página carrega
app.get('/api/tasks', async (req, res) => {
    try {
        // Puxa tudo da gaveta de tarefas (tirando o ID automático do mongo pra não confundir o seu código)
        const tasks = await collection.find({}, { projection: { _id: 0 } }).toArray();
        res.json(tasks);
    } catch (error) {
        res.status(500).send("Erro ao buscar tarefas na nuvem.");
    }
});

// ROTA POST: Salva as tarefas na nuvem sempre que você clica ou arrasta
app.post('/api/tasks', async (req, res) => {
    try {
        const tasks = req.body;
        
        // Como o seu sistema envia a lista completa, nós apagamos as antigas e salvamos a lista atualizada
        await collection.deleteMany({}); 
        
        if (tasks && tasks.length > 0) {
            await collection.insertMany(tasks);
        }
        
        res.json({ message: "Sincronizado com a nuvem com sucesso!" });
    } catch (error) {
        console.error("Erro ao salvar:", error);
        res.status(500).send("Erro ao salvar tarefas na nuvem.");
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});