let tasks = [];
let userToken = localStorage.getItem('token');
let draggedTaskIndex = null;

// --- AUTENTICAÇÃO E RECUPERAÇÃO ---
function checkAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('resetToken');
    if (resetToken) {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
        document.getElementById('box-login').style.display = 'none';
        document.getElementById('box-reset').style.display = 'block';
        return; 
    }
    if (userToken) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        loadTasks();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
    }
}

function showForgotBox() { document.getElementById('box-login').style.display = 'none'; document.getElementById('box-forgot').style.display = 'block'; }
function showLoginBox() { document.getElementById('box-forgot').style.display = 'none'; document.getElementById('box-login').style.display = 'block'; }

async function handleLogin() {
    const email = document.getElementById('emailInput').value, password = document.getElementById('passInput').value;
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (res.ok) { localStorage.setItem('token', data.token); userToken = data.token; checkAuth(); } 
    else { document.getElementById('login-msg').innerText = data.message; }
}

async function handleRegister() {
    const email = document.getElementById('emailInput').value, password = document.getElementById('passInput').value;
    const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    document.getElementById('login-msg').innerText = data.message;
}

function handleLogout() { localStorage.removeItem('token'); userToken = null; checkAuth(); }

async function handleForgotPassword() {
    const email = document.getElementById('forgotEmailInput').value;
    const msg = document.getElementById('forgot-msg');
    msg.innerText = "Enviando... ⏳";
    const res = await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const data = await res.json();
    msg.innerText = data.message;
}

async function handleResetPassword() {
    const newPassword = document.getElementById('newPassInput').value;
    const token = new URLSearchParams(window.location.search).get('resetToken');
    const res = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword }) });
    const data = await res.json();
    document.getElementById('reset-msg').innerText = data.message;
    if(res.ok) setTimeout(() => window.location.href = '/', 2500);
}

// --- LOGICA DAS TAREFAS ---
async function loadTasks() {
    const response = await fetch('/api/tasks', { headers: { 'Authorization': userToken } });
    if (response.status === 401) return handleLogout();
    tasks = await response.json();
    renderTasks();
}

async function saveTasks() {
    await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': userToken },
        body: JSON.stringify(tasks)
    });
}

function getUrgencyIcon(urgency) {
    if(urgency === 'alta') return '🔴';
    if(urgency === 'media') return '🟡';
    return '🟢';
}

function renderTasks() {
    const sections = { 'a-fazer': document.getElementById('taskList-a-fazer'), 'em-andamento': document.getElementById('taskList-em-andamento'), 'concluido': document.getElementById('taskList-concluido') };
    Object.values(sections).forEach(s => s.innerHTML = '');
    const counts = { 'a-fazer': 0, 'em-andamento': 0, 'concluido': 0 };
    const today = new Date().toISOString().split('T')[0];

    const fReq = document.getElementById('filterRequester').value;
    const fDept = document.getElementById('filterDept').value;
    const fUrg = document.getElementById('filterUrgency').value;
    const fMonth = document.getElementById('filterMonth').value;

    const selReq = document.getElementById('filterRequester'), selDept = document.getElementById('filterDept');
    const uReqs = [...new Set(tasks.map(t => t.requester || 'Eu mesmo'))], uDepts = [...new Set(tasks.map(t => t.dept || 'Geral'))];
    const cR = selReq.value, cD = selDept.value;
    selReq.innerHTML = '<option value="">🔍 Solicitantes</option>'; uReqs.forEach(r => selReq.innerHTML += `<option value="${r}" ${r===cR?'selected':''}>${r}</option>`);
    selDept.innerHTML = '<option value="">🏢 Setores</option>'; uDepts.forEach(d => selDept.innerHTML += `<option value="${d}" ${d===cD?'selected':''}>${d}</option>`);

    tasks.forEach((t, i) => {
        const req = t.requester || 'Eu mesmo', dept = t.dept || 'Geral', urg = t.urgency || 'media';
        const cMonth = t.completedAt ? t.completedAt.split('-')[1] : '';

        if (fReq && req !== fReq) return;
        if (fDept && dept !== fDept) return;
        if (fUrg && urg !== fUrg) return;
        if (fMonth && cMonth !== fMonth) return;

        counts[t.status]++;
        const isDelayed = t.deadline && t.deadline < today && t.status !== 'concluido';

        const li = document.createElement('li');
        li.className = 'task-item';
        li.draggable = true;
        li.ondragstart = () => { draggedTaskIndex = i; };

        li.innerHTML = `
            <div class="task-title-row">
                <div class="task-title ${t.status === 'concluido' ? 'completed' : ''}">
                    <button class="btn-toggle-details" onclick="toggleDetails(${i})">${t.isExpanded ? '▼' : '▶'}</button>
                    <span class="task-text">${t.text}</span>
                    <select class="status-select" onchange="updateStatus(${i}, this.value)">
                        <option value="a-fazer" ${t.status==='a-fazer'?'selected':''}>⏳</option>
                        <option value="em-andamento" ${t.status==='em-andamento'?'selected':''}>🚀</option>
                        <option value="concluido" ${t.status==='concluido'?'selected':''}>✅</option>
                    </select>
                    <span class="meta-tag">👤 ${req}</span>
                    <span class="meta-tag">🏢 ${dept}</span>
                    <span class="meta-tag ${isDelayed?'atrasado-tag':''}">📅 <input type="date" class="date-edit" value="${t.deadline||''}" onchange="updateDeadline(${i}, this.value)"></span>
                    ${t.status==='concluido'?`<span class="meta-tag done-tag">🏁 <input type="date" class="date-edit" value="${t.completedAt?t.completedAt.split('T')[0]:''}" onchange="updateCompDate(${i}, this.value)"></span>`:''}
                </div>
                <div class="task-counters">
                    <span class="counter-tag">📋 ${t.subtasks?.length || 0}</span>
                    <span class="counter-tag">💬 ${t.comments?.length || 0}</span>
                    <button class="btn-delete" onclick="deleteTask(${i})">🗑️</button>
                </div>
            </div>
            <div id="det-${i}" class="details-wrap" style="display: ${t.isExpanded?'block':'none'}">
                <div class="comments-section">
                    ${(t.comments||[]).map((c,ci)=>`<div class="comment-item">💬 ${c} <button class="btn-del-comment" onclick="delComm(${i},${ci})">✕</button></div>`).join('')}
                    <div class="input-group-small">
                        <input type="text" id="inComm-${i}" placeholder="Comentar..." onkeypress="if(event.key==='Enter') addComm(${i})">
                        <button onclick="addComm(${i})">Ok</button>
                    </div>
                </div>
                <ul class="subtask-list">
                    ${(t.subtasks||[]).map((s,si)=>`
                        <li class="subtask-item">
                            <div class="subtask-header">
                                <span class="task-text ${s.status==='concluido'?'completed':''}" style="font-size:12px">${s.text}</span>
                                <select class="status-select" onchange="updateSubStatus(${i}, ${si}, this.value)">
                                    <option value="a-fazer" ${s.status==='a-fazer'?'selected':''}>⏳</option>
                                    <option value="em-andamento" ${s.status==='em-andamento'?'selected':''}>🚀</option>
                                    <option value="concluido" ${s.status==='concluido'?'selected':''}>✅</option>
                                </select>
                                <select class="status-select" onchange="updateSubUrg(${i}, ${si}, this.value)">
                                    <option value="baixa" ${s.urgency==='baixa'?'selected':''}>🟢</option>
                                    <option value="media" ${s.urgency==='media'?'selected':''}>🟡</option>
                                    <option value="alta" ${s.urgency==='alta'?'selected':''}>🔴</option>
                                </select>
                                <button class="btn-delete" onclick="delSub(${i},${si})">🗑️</button>
                            </div>
                            <div class="comments-section comments-sub">
                                ${(s.comments||[]).map((sc,sci)=>`<div class="comment-item">💬 ${sc} <button class="btn-del-comment" onclick="delSubComm(${i},${si},${sci})">✕</button></div>`).join('')}
                                <div class="input-group-small">
                                    <input type="text" id="inSubComm-${i}-${si}" placeholder="Comentar sub..." onkeypress="if(event.key==='Enter') addSubComm(${i},${si})">
                                    <button onclick="addSubComm(${i},${si})">Ok</button>
                                </div>
                            </div>
                        </li>
                    `).join('')}
                </ul>
                <div class="input-group-small" style="margin-top:10px;">
                    <input type="text" id="inSub-${i}" placeholder="Nova sub..." onkeypress="if(event.key==='Enter') addSub(${i})">
                    <select id="urgSub-${i}" class="status-select">
                        <option value="baixa">🟢</option><option value="media" selected>🟡</option><option value="alta">🔴</option>
                    </select>
                    <button onclick="addSub(${i})">+</button>
                </div>
            </div>
        `;
        sections[t.status].appendChild(li);
    });
    Object.keys(counts).forEach(k => document.getElementById(`count-${k}`).innerText = counts[k]);
}

// --- FUNÇÕES AUXILIARES ---
function toggleDetails(i) { tasks[i].isExpanded = !tasks[i].isExpanded; renderTasks(); saveTasks(); }
function updateStatus(i, s) { tasks[i].status = s; tasks[i].completedAt = s==='concluido'?new Date().toISOString():null; renderTasks(); saveTasks(); }
function updateDeadline(i, d) { tasks[i].deadline = d; renderTasks(); saveTasks(); }
function updateCompDate(i, d) { tasks[i].completedAt = new Date(d).toISOString(); renderTasks(); saveTasks(); }
function deleteTask(i) { tasks.splice(i, 1); renderTasks(); saveTasks(); }

function addComm(i) { 
    const v = document.getElementById(`inComm-${i}`).value;
    if(!v) return; tasks[i].comments.push(v); renderTasks(); saveTasks(); 
}
function delComm(i, ci) { tasks[i].comments.splice(ci,1); renderTasks(); saveTasks(); }

function addSub(i) {
    const v = document.getElementById(`inSub-${i}`).value;
    const u = document.getElementById(`urgSub-${i}`).value;
    if(!v) return;
    if(!tasks[i].subtasks) tasks[i].subtasks = [];
    tasks[i].subtasks.push({text:v, status:'a-fazer', urgency: u, comments: []});
    renderTasks(); saveTasks();
}
function delSub(i, si) { tasks[i].subtasks.splice(si,1); renderTasks(); saveTasks(); }
function updateSubStatus(i, si, s) { tasks[i].subtasks[si].status = s; renderTasks(); saveTasks(); }
function updateSubUrg(i, si, u) { tasks[i].subtasks[si].urgency = u; renderTasks(); saveTasks(); }

function addSubComm(ti, si) {
    const v = document.getElementById(`inSubComm-${ti}-${si}`).value;
    if(!v) return;
    if(!tasks[ti].subtasks[si].comments) tasks[ti].subtasks[si].comments = [];
    tasks[ti].subtasks[si].comments.push(v);
    renderTasks(); saveTasks();
}
function delSubComm(ti, si, ci) { tasks[ti].subtasks[si].comments.splice(ci,1); renderTasks(); saveTasks(); }

function addTask() {
    const t = document.getElementById('taskInput'), rS = document.getElementById('requesterSelect'), rC = document.getElementById('customRequesterInput');
    const dS = document.getElementById('deptSelect'), dC = document.getElementById('customDeptInput'), dl = document.getElementById('deadlineInput'), ur = document.getElementById('urgencyInput');
    if(!t.value) return;
    const req = rS.value === 'Outro' ? rC.value : rS.value;
    const dep = dS.value === 'Outro' ? dC.value : dS.value;
    tasks.push({ text: t.value, requester: req||'Eu mesmo', dept: dep||'Geral', deadline: dl.value, urgency: ur.value, status: 'a-fazer', subtasks: [], comments: [], isExpanded: false });
    t.value = ''; renderTasks(); saveTasks();
}

function exportToExcel() {
    let csv = "\uFEFFTítulo;Status;Solicitante;Setor;Prazo;Conclusão;Subtarefas;Comentários\n";
    tasks.forEach(t => {
        const subs = (t.subtasks||[]).map(s => s.text).join(" | ");
        const comms = (t.comments||[]).join(" | ");
        csv += `"${t.text}";"${t.status}";"${t.requester}";"${t.dept}";"${t.deadline||''}";"${t.completedAt?t.completedAt.split('T')[0]:''}";"${subs}";"${comms}"\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = "Tarefas_Completo.csv";
    link.click();
}

function toggleRequesterInput() { document.getElementById('customRequesterInput').style.display = document.getElementById('requesterSelect').value==='Outro'?'inline-block':'none'; }
function toggleDeptInput() { document.getElementById('customDeptInput').style.display = document.getElementById('deptSelect').value==='Outro'?'inline-block':'none'; }
function allowDrop(ev) { ev.preventDefault(); }
function drop(ev, s) { ev.preventDefault(); if(draggedTaskIndex!==null) { updateStatus(draggedTaskIndex, s); draggedTaskIndex=null; } }

checkAuth();
