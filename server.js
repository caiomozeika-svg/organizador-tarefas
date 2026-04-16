const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static('public'));

app.get('/api/tasks', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') return res.json([]); 
            return res.status(500).send('Erro ao ler o arquivo.');
        }
        res.json(JSON.parse(data || '[]'));
    });
});

app.post('/api/tasks', (req, res) => {
    fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2), (err) => {
        if (err) return res.status(500).send('Erro ao salvar as tarefas.');
        res.send('Salvo com sucesso!');
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando! Abra seu navegador e acesse: http://localhost:${PORT}`);
});
