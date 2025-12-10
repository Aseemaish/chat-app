const socket = io();

// UI Elements
const els = {
    login: document.getElementById('login-screen'),
    chat: document.getElementById('chat-screen'),
    msgs: document.getElementById('messages-area'),
    joinBtn: document.getElementById('join-btn'),
    sendBtn: document.getElementById('send-btn'),
    txtInput: document.getElementById('message-input'),
    imgInput: document.getElementById('image-input'),
    micBtn: document.getElementById('mic-btn'),
    skipBtn: document.getElementById('skip-btn'),
    endBtn: document.getElementById('end-btn'),
    reportBtn: document.getElementById('report-btn'),
    saveBtn: document.getElementById('save-btn'),
    status: document.getElementById('status-msg'),
    online: document.getElementById('online-count'),
    pName: document.getElementById('partner-name'),
    typing: document.getElementById('typing-indicator'),
    inputs: {
        name: document.getElementById('username'),
        age: document.getElementById('age'),
        interests: document.getElementById('interests')
    }
};

let currentRoom = null;

// 1. INITIALIZE EMOJI PICKER (Safe Mode)
try {
    const picker = new EmojiButton();
    const emojiBtn = document.getElementById('emoji-btn');
    picker.on('emoji', s => els.txtInput.value += s.emoji);
    emojiBtn.addEventListener('click', () => picker.togglePicker(emojiBtn));
} catch(e) { console.log("Emoji lib not loaded"); }

// 2. SOCKET EVENTS
socket.on('online_count', c => els.online.innerText = c);

// Login Logic
els.joinBtn.addEventListener('click', () => {
    const name = els.inputs.name.value;
    const age = els.inputs.age.value;
    const ints = els.inputs.interests.value.split(',').map(s=>s.trim()).filter(s=>s);

    if(!name || !age) return alert("Name and Age required!");

    socket.emit('user_login', { name, age, interests: ints });
    els.status.innerText = "Connecting...";
    els.joinBtn.disabled = true;
});

// Chat Started
socket.on('chat_start', (data) => {
    currentRoom = data.room;
    els.login.classList.add('hidden');
    els.chat.classList.remove('hidden');
    els.msgs.innerHTML = '';
    addSysMsg("Matched! Say Hello.");
});

socket.on('system_message', msg => {
    addSysMsg(msg);
    if(msg.includes('Matched:')) els.pName.innerText = msg.split(':')[1].split('(')[0];
});

// Messaging
els.sendBtn.addEventListener('click', sendText);
els.txtInput.addEventListener('keypress', e => { if(e.key==='Enter') sendText() });

function sendText() {
    const txt = els.txtInput.value;
    if(txt.trim() && currentRoom) {
        addMsg(txt, 'my-msg');
        socket.emit('send_message', { room: currentRoom, message: txt });
        els.txtInput.value = '';
    }
}

// Receive Data
socket.on('receive_message', data => {
    if(data.type === 'text') addMsg(data.content, 'their-msg', data.time);
    if(data.type === 'image') addImg(data.content, 'their-msg', data.time);
    if(data.type === 'audio') addAudio(data.content, 'their-msg');
});

// Typing Indicator
els.txtInput.addEventListener('input', () => {
    if(currentRoom) socket.emit('typing');
    setTimeout(() => socket.emit('stop_typing'), 1000);
});
socket.on('partner_typing', () => els.typing.classList.remove('hidden'));
socket.on('partner_stop_typing', () => els.typing.classList.add('hidden'));

socket.on('partner_left', () => {
    addSysMsg("Partner disconnected.");
    els.pName.innerText = "Disconnected";
});

// 3. MEDIA FEATURES
// Image
els.imgInput.addEventListener('change', function() {
    const file = this.files[0];
    if(file && currentRoom) {
        const reader = new FileReader();
        reader.onload = e => {
            addImg(e.target.result, 'my-msg');
            socket.emit('send_image', { room: currentRoom, image: e.target.result });
        }
        reader.readAsDataURL(file);
    }
});

// Voice
let mediaRecorder, chunks = [];
els.micBtn.addEventListener('mousedown', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        chunks = [];
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            socket.emit('send_voice', { room: currentRoom, buffer: blob });
            addAudio(URL.createObjectURL(blob), 'my-msg');
        };
        mediaRecorder.start();
        els.micBtn.classList.add('recording');
    } catch(e) { alert("Mic access denied"); }
});

els.micBtn.addEventListener('mouseup', () => {
    if(mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        els.micBtn.classList.remove('recording');
    }
});

// 4. BUTTON ACTIONS
els.skipBtn.addEventListener('click', () => {
    socket.emit('skip_partner');
    els.msgs.innerHTML = '';
    addSysMsg("Skipped. Searching...");
});

els.endBtn.addEventListener('click', () => {
    socket.emit('leave_chat');
    els.chat.classList.add('hidden');
    els.login.classList.remove('hidden');
    els.joinBtn.disabled = false;
    els.status.innerText = "";
});

els.reportBtn.addEventListener('click', () => {
    if(confirm("Report User?")) socket.emit('report_partner');
});

els.saveBtn.addEventListener('click', () => {
    html2pdf().from(els.msgs).save("chat.pdf");
});

// Helpers
function addMsg(txt, cls, time = '') {
    const d = document.createElement('div');
    d.className = `message ${cls}`;
    d.innerHTML = `<span>${txt}</span><span class="time">${time}</span>`;
    els.msgs.appendChild(d);
    els.msgs.scrollTop = els.msgs.scrollHeight;
}
function addImg(src, cls, time = '') {
    const d = document.createElement('div');
    d.className = `message ${cls}`;
    d.innerHTML = `<img src="${src}" class="blur-img" onclick="this.classList.toggle('unblur')"><span class="time">${time}</span>`;
    els.msgs.appendChild(d);
    els.msgs.scrollTop = els.msgs.scrollHeight;
}
function addAudio(url, cls) {
    const d = document.createElement('div');
    d.className = `message ${cls}`;
    d.innerHTML = `<audio controls src="${url}"></audio>`;
    els.msgs.appendChild(d);
    els.msgs.scrollTop = els.msgs.scrollHeight;
}
function addSysMsg(txt) {
    const d = document.createElement('div');
    d.className = 'sys-msg';
    d.innerText = txt;
    els.msgs.appendChild(d);
    els.msgs.scrollTop = els.msgs.scrollHeight;
}