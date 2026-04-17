let tasks = [];
let userToken = localStorage.getItem('token');
let currentOpenTaskIndex = null;

function checkAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('resetToken')) {
        document.getElementById('login-screen').style.display = 'flex'; document.getElementById('main-content').style.display = 'none';
        document.getElementById('box-login').style.display = 'none'; document.getElementById('box-reset').style.display = 'block'; return; 
    }
    if (userToken) { document.getElementById('login-screen').style.display = 'none'; document.getElementById('main-content').style.display = 'block'; loadTasks(); } 
    else { document.getElementById('login-screen').style.display = 'flex'; document.getElementById('main-content').style.display = 'none'; }
}

function showForgotBox() { document.getElementById('box-login').style.display = 'none'; document.getElementById('box-forgot').style.display = 'block'; }
function showLoginBox() { document.getElementById('box-forgot').style.display = 'none'; document.getElementById('box-login').style.display = 'block'; }
async function handleLogin() { const r = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:document.getElementById('emailInput').value,password:document.getElementById('passInput').value})}); const d = await r.json(); if(r.ok){localStorage.setItem('token', d.token); userToken=d.token; checkAuth();} else document.getElementById('login-msg').innerText = d.message; }
async function handleRegister() { const r = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:document.getElementById('emailInput').value,password:document.getElementById('passInput').value})}); const d = await r.json(); document.getElementById('login-msg').innerText = d.message; }
function handleLogout() { localStorage.removeItem('token'); userToken = null; checkAuth(); }
async function handleForgotPassword() { document.getElementById('forgot-msg').innerText="Enviando..."; const r = await fetch('/api/forgot-password', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:document.getElementById('forgotEmailInput').value})}); const d = await r.json(); document.getElementById('forgot-msg').innerText = d.message; }
async function handleResetPassword() { const r = await fetch('/api/reset-password', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:new URLSearchParams(window.location.search).get('resetToken'), newPassword:document.getElementById('newPassInput').value})}); const d = await r.json(); document.getElementById('reset-msg').innerText = d.message; if(r.ok) setTimeout(()=>window.location.href='/', 2500); }

async function loadTasks() {
    const res = await fetch('/api/tasks', { headers: { 'Authorization': userToken } });
    if (res.status === 401) return handleLogout();
    tasks = await res.json();
    renderTasks();
}

async function saveTasks() {
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': userToken }, body: JSON.stringify(tasks) });
}

function renderTasks() {
    const sections = { 'a-fazer': document.getElementById('taskList-a-fazer'), 'em-andamento': document.getElementById('taskList-em-andamento'), 'concluido': document.getElementById('taskList-concluido') };
    Object.values(sections).forEach(s => s.innerHTML = '');
    const counts = { 'a-fazer': 0, 'em-andamento': 0, 'concluido': 0 };

    // Filtros dinâmicos que leem as tarefas (MANTIDOS)
    const selReq = document.getElementById('filterRequester'), selDept = document.getElementById('filterDept');
    const uReqs = [...new Set(tasks.map(t => t.requester || 'Eu mesmo'))].sort();
    const uDepts = [...new Set(tasks.map(t => t.dept || 'Geral'))].sort();
    
    const currReq = selReq.value, currDept = selDept.value;
    selReq.innerHTML = '<option value="">🔍 Solicitantes</option>'; 
    uReqs.forEach(r => selReq.innerHTML += `<option value="${r}" ${r===currReq?'selected':''}>${r}</option>`);
    selDept.innerHTML = '<option value="">🏢 Setores</option>'; 
    uDepts.forEach(d => selDept.innerHTML += `<option value="${d}" ${d===currDept?'selected':''}>${d}</option>`);

    const fReq = document.getElementById('filterRequester').value, fDept = document.getElementById('filterDept').value, fMonth = document.getElementById('filterMonth').value;
    const today = new Date().toISOString().split('T')[0];

    tasks.forEach((t, i) => {
        const req = t.requester || 'Eu mesmo', dept = t.dept || 'Geral', urg = t.urgency || 'media';
        const cMonth = t.completedAt ? t.completedAt.split('-')[1] : '';
        if ((fReq && req !== fReq) || (fDept && dept !== fDept) || (fMonth && cMonth !== fMonth)) return;

        counts[t.status]++;
        const isDelayed = t.deadline && t.deadline < today && t.status !== 'concluido';

        const li = document.createElement('li');
        li.className = 'task-row';
        
        li.innerHTML = `
            <div class="task-title-cell ${t.status === 'concluido' ? 'completed-text' : ''}" onclick="openModal(${i})">
                📄 ${t.text}
            </div>
            <div><span class="meta-tag">${req}</span> <span class="meta-tag">${dept}</span></div>
            
            <div class="${isDelayed ? 'atrasado-container' : ''}">
                ${isDelayed ? '⚠️' : ''} <input type="date" class="date-edit ${isDelayed ? 'atrasado-text' : ''}" value="${t.deadline||''}" onchange="updateRowField(${i}, 'deadline', this.value)">
            </div>
            
            <div>
                <select class="urgency-select" onchange="updateRowField(${i}, 'urgency', this.value)">
                    <option value="baixa" ${urg==='baixa'?'selected':''}>🟢 Baixa</option>
                    <option value="media" ${urg==='media'?'selected':''}>🟡 Média</option>
                    <option value="alta" ${urg==='alta'?'selected':''}>🔴 Alta</option>
                </select>
            </div>
            <div>
                <select class="status-select ${t.status}" onchange="updateRowStatus(${i}, this.value)">
                    <option value="a-fazer" ${t.status==='a-fazer'?'selected':''}>Fazer</option>
                    <option value="em-andamento" ${t.status==='em-andamento'?'selected':''}>Andamento</option>
                    <option value="concluido" ${t.status==='concluido'?'selected':''}>Feito</option>
                </select>
            </div>
            <div class="row-counters" onclick="openModal(${i})">
                <span>📋 ${t.subtasks?.length||0}</span>
                <span>💬 ${t.comments?.length||0}</span>
            </div>
            <div><button class="btn-delete" onclick="deleteTask(${i})">🗑️</button></div>
        `;
        sections[t.status].appendChild(li);
    });
    Object.keys(counts).forEach(k => document.getElementById(`count-${k}`).innerText = counts[k]);
}

function updateRowField(i, field, value) { tasks[i][field] = value; saveTasks(); }
function updateRowStatus(i, s) { tasks[i].status = s; tasks[i].completedAt = s==='concluido'?new Date().toISOString():null; renderTasks(); saveTasks(); }
function deleteTask(i) { tasks.splice(i, 1); renderTasks(); saveTasks(); }

// Nova Lógica de Adicionar Tarefa (Lendo direto dos campos de texto)
function addTask() {
    const t = document.getElementById('taskInput').value;
    const req = document.getElementById('requesterInput').value.trim();
    const dep = document.getElementById('deptInput').value.trim();
    
    if(!t) return;
    
    tasks.push({ 
        text: t, 
        requester: req || 'Eu mesmo', 
        dept: dep || 'Administrativo', 
        deadline: '', 
        urgency: 'media', 
        status: 'a-fazer', 
        subtasks: [], 
        comments: [] 
    });
    
    // Limpando os campos após salvar
    document.getElementById('taskInput').value = ''; 
    document.getElementById('requesterInput').value = '';
    document.getElementById('deptInput').value = '';
    
    renderTasks(); saveTasks();
}

function openModal(index) {
    currentOpenTaskIndex = index;
    const t = tasks[index];
    document.getElementById('modalTaskTitle').innerText = `📄 ${t.text}`;
    document.getElementById('taskModal').style.display = 'flex';
    renderModalContent();
}

function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
    currentOpenTaskIndex = null;
    renderTasks(); 
}

function renderModalContent() {
    if(currentOpenTaskIndex === null) return;
    const i = currentOpenTaskIndex;
    const t = tasks[i];
    const body = document.getElementById('modalTaskBody');
    
    let html = `<div class="modal-section-title">📋 Subtarefas</div>`;
    
    (t.subtasks||[]).forEach((s, si) => {
        html += `
            <div class="subtask-item-modal">
                <input type="text" value="${s.text}" onchange="updSubText(${i}, ${si}, this.value)" style="flex:2; background:transparent; border:none; color:#fff; font-size:13px; outline:none;" class="${s.status==='concluido'?'completed-text':''}">
                <select class="status-select ${s.status}" style="flex:1" onchange="updSubStatus(${i}, ${si}, this.value)">
                    <option value="a-fazer" ${s.status==='a-fazer'?'selected':''}>Fazer</option>
                    <option value="em-andamento" ${s.status==='em-andamento'?'selected':''}>Andamento</option>
                    <option value="concluido" ${s.status==='concluido'?'selected':''}>Feito</option>
                </select>
                <button class="btn-delete" onclick="delSub(${i}, ${si})">✕</button>
            </div>
        `;
    });
    
    html += `
        <div class="input-flex">
            <input type="text" id="newSubInput" placeholder="+ Adicionar subtarefa..." onkeypress="if(event.key==='Enter') addSub(${i})">
            <button onclick="addSub(${i})">Add</button>
        </div>
    `;

    html += `<div class="modal-section-title" style="margin-top:30px;">💬 Comentários Internos</div>`;
    
    (t.comments||[]).forEach((c, ci) => {
        html += `<div class="comment-item-modal"><span>${c}</span> <button class="btn-delete" onclick="delComm(${i}, ${ci})">✕</button></div>`;
    });
    
    html += `
        <div class="input-flex">
            <input type="text" id="newCommInput" placeholder="Escreva uma atualização..." onkeypress="if(event.key==='Enter') addComm(${i})">
            <button onclick="addComm(${i})">Enviar</button>
        </div>
    `;
    
    body.innerHTML = html;
}

function updSubText(i, si, v) { tasks[i].subtasks[si].text = v; saveTasks(); renderModalContent(); }
function updSubStatus(i, si, s) { tasks[i].subtasks[si].status = s; saveTasks(); renderModalContent(); }
function addSub(i) { const v = document.getElementById('newSubInput').value; if(!v) return; tasks[i].subtasks.push({text:v, status:'a-fazer'}); saveTasks(); renderModalContent(); }
function delSub(i, si) { tasks[i].subtasks.splice(si,1); saveTasks(); renderModalContent(); }
function addComm(i) { const v = document.getElementById('newCommInput').value; if(!v) return; tasks[i].comments.push(v); saveTasks(); renderModalContent(); }
function delComm(i, ci) { tasks[i].comments.splice(ci,1); saveTasks(); renderModalContent(); }

function exportToExcel() {
    let csv = "\uFEFFTítulo;Status;Solicitante;Setor;Prazo;Subtarefas;Comentários\n";
    tasks.forEach(t => {
        const subs = (t.subtasks||[]).map(s => s.text).join(" | "); const comms = (t.comments||[]).join(" | ");
        csv += `"${t.text}";"${t.status}";"${t.requester||''}";"${t.dept||''}";"${t.deadline||''}";"${subs}";"${comms}"\n`;
    });
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); link.download = "Tarefas.csv"; link.click();
}

checkAuth();
