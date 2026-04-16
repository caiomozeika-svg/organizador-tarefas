let tasks = [];
let filteredTasks = [];
let draggedTaskIndex = null;
let userToken = localStorage.getItem('token');

// --- CONTROLE DE ACESSO ---
function checkAuth() {
    if (userToken) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        loadTasks();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
    }
}

async function handleLogin() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passInput').value;
    const msg = document.getElementById('login-msg');

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok) {
        localStorage.setItem('token', data.token);
        userToken = data.token;
        checkAuth();
    } else {
        msg.innerText = data.message;
        msg.style.color = "#f87171";
    }
}

async function handleRegister() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passInput').value;
    const msg = document.getElementById('login-msg');

    if(!email || !password) return alert("Preencha tudo!");

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    msg.innerText = data.message;
    msg.style.color = res.ok ? "#4ade80" : "#f87171";
}

function handleLogout() {
    localStorage.removeItem('token');
    userToken = null;
    checkAuth();
}

// --- LOGICA DE TAREFAS ---
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks', { headers: { 'Authorization': userToken } });
        if (response.status === 401 || response.status === 403) return handleLogout();
        tasks = await response.json();
        renderTasks();
    } catch (error) { console.error("Erro ao carregar:", error); }
}

async function saveTasks() {
    try {
        await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': userToken },
            body: JSON.stringify(tasks)
        });
    } catch (error) { console.error("Erro ao salvar:", error); }
}

function getUrgencyIcon(urgency) {
    if(urgency === 'alta') return '<span class="urg-alta">🔴 Alta</span>';
    if(urgency === 'media') return '<span class="urg-media">🟡 Média</span>';
    return '<span class="urg-baixa">🟢 Baixa</span>';
}

function toggleRequesterInput() {
    const sel = document.getElementById('requesterSelect'), cust = document.getElementById('customRequesterInput');
    if (sel.value === 'Outro') { cust.style.display = 'inline-block'; cust.focus(); } else { cust.style.display = 'none'; cust.value = ''; }
}

function toggleDeptInput() {
    const sel = document.getElementById('deptSelect'), cust = document.getElementById('customDeptInput');
    if (sel.value === 'Outro') { cust.style.display = 'inline-block'; cust.focus(); } else { cust.style.display = 'none'; cust.value = ''; }
}

// NOVA FUNÇÃO: Abre e fecha a setinha sem quebrar as datas
function toggleDetailsCustom(index) {
    const details = document.getElementById(`details-${index}`);
    const btn = document.getElementById(`btn-toggle-${index}`);
    const isOpen = !details.open;
    details.open = isOpen;
    tasks[index].isExpanded = isOpen;
    btn.innerText = isOpen ? '▼' : '▶';
    saveTasks();
}

function renderTasks() {
    const sections = {
        'a-fazer': document.getElementById('taskList-a-fazer'),
        'em-andamento': document.getElementById('taskList-em-andamento'),
        'concluido': document.getElementById('taskList-concluido')
    };

    Object.values(sections).forEach(s => s.innerHTML = '');
    const counts = { 'a-fazer': 0, 'em-andamento': 0, 'concluido': 0 };
    const today = new Date().toISOString().split('T')[0];
    
    const filterReq = document.getElementById('filterRequester').value;
    const filterDept = document.getElementById('filterDept').value;
    const filterMonth = document.getElementById('filterMonth').value;
    const filterUrg = document.getElementById('filterUrgency').value;

    const filterSelectReq = document.getElementById('filterRequester');
    const filterSelectDept = document.getElementById('filterDept');
    
    const uniqueReqs = [...new Set(tasks.map(t => t.requester || 'Eu mesmo'))].sort();
    const uniqueDepts = [...new Set(tasks.map(t => t.dept || 'Geral'))].sort();
    
    const currReq = filterSelectReq.value;
    filterSelectReq.innerHTML = '<option value="">🔍 Todos os solicitantes</option>';
    uniqueReqs.forEach(req => filterSelectReq.innerHTML += `<option value="${req}" ${req === currReq ? 'selected' : ''}>${req}</option>`);

    const currDept = filterSelectDept.value;
    filterSelectDept.innerHTML = '<option value="">🏢 Todos os setores</option>';
    uniqueDepts.forEach(dept => filterSelectDept.innerHTML += `<option value="${dept}" ${dept === currDept ? 'selected' : ''}>${dept}</option>`);

    filteredTasks = []; 

    tasks.forEach((task, taskIndex) => {
        if (!task.comments) task.comments = [];
        if (!task.subtasks) task.subtasks = [];
        if (task.status === 'concluido' && !task.completedAt) task.completedAt = new Date().toISOString();

        const req = task.requester || 'Eu mesmo';
        const dept = task.dept || 'Geral';
        const urg = task.urgency || 'media';
        const completionMonth = task.completedAt ? task.completedAt.split('-')[1] : '';

        if (filterReq && req !== filterReq) return;
        if (filterDept && dept !== filterDept) return;
        if (filterUrg && urg !== filterUrg) return;
        if (filterMonth && completionMonth !== filterMonth) return; 

        filteredTasks.push(task); 

        const isDelayed = task.deadline && task.deadline < today && task.status !== 'concluido';
        const displayStatus = task.status || 'a-fazer';
        counts[displayStatus]++;

        const li = document.createElement('li');
        li.className = `task-item ${isDelayed ? 'is-delayed' : ''}`;
        li.draggable = true;
        li.ondragstart = () => { draggedTaskIndex = taskIndex; setTimeout(() => li.classList.add('dragging'), 0); };
        li.ondragend = () => { li.classList.remove('dragging'); draggedTaskIndex = null; };

        const compDateValue = task.completedAt ? task.completedAt.split('T')[0] : '';

        const titleRow = document.createElement('div');
        titleRow.className = 'task-title-row';
        titleRow.innerHTML = `
            <div class="task-title ${task.status === 'concluido' ? 'completed' : ''}">
                <button id="btn-toggle-${taskIndex}" class="btn-toggle-details" onclick="toggleDetailsCustom(${taskIndex})">
                    ${task.isExpanded ? '▼' : '▶'}
                </button>
                <span class="task-text">${task.text}</span>
                <select class="status-select status-${task.status}" onchange="updateStatus(${taskIndex}, this.value)">
                    <option value="a-fazer" ${task.status === 'a-fazer' ? 'selected' : ''}>⏳ Fazer</option>
                    <option value="em-andamento" ${task.status === 'em-andamento' ? 'selected' : ''}>🚀 Andamento</option>
                    <option value="concluido" ${task.status === 'concluido' ? 'selected' : ''}>✅ Concluído</option>
                </select>
                <span class="meta-tag">👤 ${req}</span>
                <span class="meta-tag">🏢 ${dept}</span>
                <span class="meta-tag">${getUrgencyIcon(urg)}</span>
                <span class="meta-tag ${isDelayed ? 'atrasado-tag' : ''}">
                    ${isDelayed ? '⚠️' : '📅'} <input type="date" class="date-edit" value="${task.deadline || ''}" onchange="updateDeadline(${taskIndex}, this.value)">
                </span>
                ${task.status === 'concluido' ? `
                    <span class="meta-tag done-tag">
                        🏁 Concluiu: <input type="date" class="date-edit" value="${compDateValue}" onchange="updateCompletionDate(${taskIndex}, this.value)">
                    </span>
                ` : ''}
            </div>
            
            <div class="task-counters">
                <span class="counter-tag" title="Subtarefas">📋 ${task.subtasks.length}</span>
                <span class="counter-tag" title="Comentários">💬 ${task.comments.length}</span>
                <button class="btn-delete" onclick="deleteTask(${taskIndex})">🗑️</button>
            </div>
        `;

        li.appendChild(titleRow);

        const detailsWrap = document.createElement('details');
        detailsWrap.id = `details-${taskIndex}`;
        detailsWrap.className = 'details-wrap custom-details';
        if (task.isExpanded) detailsWrap.open = true;

        // Escondendo a barra de resumo original do HTML para usar a nossa
        const summary = document.createElement('summary');
        summary.style.display = 'none';
        detailsWrap.appendChild(summary);

        const commentBox = document.createElement('div');
        commentBox.className = 'comments-section';
        commentBox.innerHTML = `
            ${task.comments.map((c, i) => `<div class="comment-item"><span>💬 ${c}</span><button class="btn-del-comment" onclick="deleteTaskComment(${taskIndex}, ${i})">✕</button></div>`).join('')}
            <div class="comment-input-group">
                <input type="text" id="taskComm-${taskIndex}" placeholder="Add coment..." onkeypress="if(event.key==='Enter') addTaskComment(${taskIndex})">
                <button class="btn-small" onclick="addTaskComment(${taskIndex})">Ok</button>
            </div>
        `;
        detailsWrap.appendChild(commentBox);

        const subList = document.createElement('ul');
        subList.className = 'subtask-list';
        task.subtasks.forEach((st, si) => {
            if (!st.comments) st.comments = [];
            const subLi = document.createElement('li');
            subLi.className = 'subtask-item';
            
            subLi.innerHTML = `
                <div class="subtask-header">
                    <div class="task-title ${st.status === 'concluido' ? 'completed' : ''}">
                        <span class="task-text" style="font-size:11px;">${st.text}</span>
                        <select class="status-select status-${st.status}" onchange="updateSubStatus(${taskIndex}, ${si}, this.value)">
                            <option value="a-fazer" ${st.status === 'a-fazer' ? 'selected' : ''}>⏳</option>
                            <option value="em-andamento" ${st.status === 'em-andamento' ? 'selected' : ''}>🚀</option>
                            <option value="concluido" ${st.status === 'concluido' ? 'selected' : ''}>✅</option>
                        </select>
                        <span class="meta-tag">${getUrgencyIcon(st.urgency || 'media')}</span>
                        <span class="meta-tag">📅 <input type="date" class="date-edit" value="${st.deadline || ''}" onchange="updateSubDeadline(${taskIndex}, ${si}, this.value)"></span>
                    </div>
                    <button class="btn-small btn-delete" onclick="deleteSub(${taskIndex}, ${si})">🗑️</button>
                </div>

                <div class="comments-section comments-subtask">
                    ${st.comments.map((c, ci) => `<div class="comment-item"><span>💬 ${c}</span><button class="btn-del-comment" onclick="deleteSubComment(${taskIndex}, ${si}, ${ci})">✕</button></div>`).join('')}
                    <div class="comment-input-group">
                        <input type="text" id="stComm-${taskIndex}-${si}" placeholder="Sub coment..." onkeypress="if(event.key==='Enter') addSubComment(${taskIndex}, ${si})">
                        <button class="btn-small" onclick="addSubComment(${taskIndex}, ${si})">Ok</button>
                    </div>
                </div>
            `;
            subList.appendChild(subLi);
        });
        detailsWrap.appendChild(subList);

        const newSub = document.createElement('div');
        newSub.className = 'comment-input-group';
        newSub.style.marginTop = '10px';
        newSub.innerHTML = `
            <input type="text" id="ns-${taskIndex}" placeholder="Nova sub..." onkeypress="if(event.key==='Enter') addSub(${taskIndex})">
            <select id="urg-${taskIndex}" class="status-select">
                <option value="baixa">🟢</option><option value="media" selected>🟡</option><option value="alta">🔴</option>
            </select>
            <button class="btn-small" onclick="addSub(${taskIndex})">+</button>
        `;
        detailsWrap.appendChild(newSub);

        li.appendChild(detailsWrap);
        sections[displayStatus].appendChild(li);
    });

    Object.keys(counts).forEach(k => document.getElementById(`count-${k}`).innerText = counts[k]);
}

function updateStatus(i, s) { tasks[i].status = s; tasks[i].completedAt = (s === 'concluido') ? new Date().toISOString() : null; renderTasks(); saveTasks(); }
function updateCompletionDate(i, d) { tasks[i].completedAt = new Date(d).toISOString(); renderTasks(); saveTasks(); }
function updateDeadline(i, d) { tasks[i].deadline = d; renderTasks(); saveTasks(); }
function deleteTask(i) { tasks.splice(i, 1); renderTasks(); saveTasks(); }

function addTask() {
    const t = document.getElementById('taskInput'), sReq = document.getElementById('requesterSelect');
    const cReq = document.getElementById('customRequesterInput'), sDept = document.getElementById('deptSelect');
    const cDept = document.getElementById('customDeptInput'), d = document.getElementById('deadlineInput');
    const u = document.getElementById('urgencyInput');
    if(!t.value) return;
    let req = sReq.value === 'Outro' ? cReq.value.trim() : sReq.value;
    let dept = sDept.value === 'Outro' ? cDept.value.trim() : sDept.value;
    tasks.push({ text: t.value, requester: req || 'Eu mesmo', dept: dept || 'Geral', deadline: d.value, urgency: u.value, status: 'a-fazer', completedAt: null, subtasks: [], comments: [], isExpanded: false });
    t.value = ''; sReq.value = ''; cReq.value = ''; cReq.style.display = 'none'; sDept.value = ''; cDept.value = ''; cDept.style.display = 'none'; d.value = '';
    renderTasks(); saveTasks();
}

function addSub(i) {
    const val = document.getElementById(`ns-${i}`).value;
    const urg = document.getElementById(`urg-${i}`).value;
    if(!val) return;
    tasks[i].subtasks.push({ text: val, status: 'a-fazer', deadline: '', urgency: urg, comments: [] });
    renderTasks(); saveTasks();
}
function updateSubStatus(ti, si, s) { tasks[ti].subtasks[si].status = s; renderTasks(); saveTasks(); }
function updateSubDeadline(ti, si, d) { tasks[ti].subtasks[si].deadline = d; renderTasks(); saveTasks(); }
function deleteSub(ti, si) { tasks[ti].subtasks.splice(si, 1); renderTasks(); saveTasks(); }

function addTaskComment(i) {
    const inp = document.getElementById(`taskComm-${i}`);
    if(!inp.value) return;
    tasks[i].comments.push(inp.value);
    inp.value = ''; renderTasks(); saveTasks();
}
function deleteTaskComment(ti, ci) { tasks[ti].comments.splice(ci, 1); renderTasks(); saveTasks(); }
function addSubComment(ti, si) {
    const inp = document.getElementById(`stComm-${ti}-${si}`);
    if(!inp.value) return;
    tasks[ti].subtasks[si].comments.push(inp.value);
    inp.value = ''; renderTasks(); saveTasks();
}
function deleteSubComment(ti, si, ci) { tasks[ti].subtasks[si].comments.splice(ci, 1); renderTasks(); saveTasks(); }

function allowDrop(ev) { ev.preventDefault(); }
function drop(ev, newStatus) {
    ev.preventDefault();
    if (draggedTaskIndex !== null && tasks[draggedTaskIndex].status !== newStatus) {
        updateStatus(draggedTaskIndex, newStatus);
    }
}

checkAuth();
