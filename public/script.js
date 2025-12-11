const socket = io();

const els = {
    login: document.getElementById('login-screen'),
    chat: document.getElementById('chat-screen'),
    msgs: document.getElementById('messages-area'),
    joinBtn: document.getElementById('join-btn'),
    sendBtn: document.getElementById('send-btn'),
    txtInput: document.getElementById('message-input'),
    imgInput: document.getElementById('image-input'),
    micBtn: document.getElementById('mic-btn'),
    emojiBtn: document.getElementById('emoji-btn'),
    picker: document.getElementById('emoji-picker'),
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
        country: document.getElementById('country'),
        interests: document.getElementById('interests')
    }
};

let currentRoom = null;

// 1. EMOJI
els.emojiBtn.addEventListener('click', () => els.picker.classList.toggle('hidden'));
els.picker.querySelectorAll('span').forEach(span => {
    span.addEventListener('click', () => {
        els.txtInput.value += span.innerText;
        els.picker.classList.add('hidden');
        els.txtInput.focus();
    });
});

// 2. LOGIN
socket.on('online_count', c => els.online.innerText = c);

els.joinBtn.addEventListener('click', () => {
    const name = els.inputs.name.value;
    const age = els.inputs.age.value;
    const country = els.inputs.country.value;
    const ints = els.inputs.interests.value.split(',').map(s=>s.trim()).filter(s=>s);

    if(!name || !age) return alert("Please fill Name and Age");
    if(country === "🌍") return alert("Please select a Country");

    socket.emit('user_login', { name, age, country, interests: ints });
    els.status.innerText = "Connecting...";
    els.joinBtn.disabled = true;
});

// 3. CHAT START (Fixed Flag & Name)
socket.on('chat_start', (data) => {
    currentRoom = data.room;
    els.login.classList.add('hidden');
    els.chat.classList.remove('hidden');
    els.msgs.innerHTML = '';
    
    // UPDATE HEADER
    els.pName.innerText = `${data.partner.country} ${data.partner.name}`;
    
    addSysMsg("Encryption active. Say Hello!");
});

socket.on('system_message', msg => {
    addSysMsg(msg);
});

// 4. MESSAGING
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

socket.on('receive_message', data => {
    if(data.type === 'text') addMsg(data.content, 'their-msg');
    if(data.type === 'image') addImg(data.content, 'their-msg');
    if(data.type === 'audio') addAudio(data.content, 'their-msg');
});

// 5. HELPER FUNCTIONS (Time & Ticks)
function getCurrentTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMsg(txt, cls) {
    const d = document.createElement('div');
    d.className = `message ${cls}`;
    const tickHtml = cls === 'my-msg' ? '<i class="fa-solid fa-check-double tick"></i>' : '';
    d.innerHTML = `<span>${txt}</span><div class="msg-meta"><span class="msg-time">${getCurrentTime()}</span>${tickHtml}</div>`;
    els.msgs.appendChild(d);
    els.msgs.scrollTop = els.msgs.scrollHeight;
}

function addImg(src, cls) {
    const d = document.createElement('div');
    d.className = `message ${cls}`;
    const tickHtml = cls === 'my-msg' ? '<i class="fa-solid fa-check-double tick"></i>' : '';
    d.innerHTML = `<img src="${src}" class="blur-img" onclick="this.classList.toggle('unblur')"><div class="msg-meta"><span class="msg-time">${getCurrentTime()}</span>${tickHtml}</div>`;
    els.msgs.appendChild(d);
    els.msgs.scrollTop = els.msgs.scrollHeight;
}

function addAudio(url, cls) {
    const d = document.createElement('div');
    d.className = `message ${cls}`;
    const tickHtml = cls === 'my-msg' ? '<i class="fa-solid fa-check-double tick"></i>' : '';
    d.innerHTML = `<audio controls src="${url}"></audio><div class="msg-meta"><span class="msg-time">${getCurrentTime()}</span>${tickHtml}</div>`;
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

// 6. TYPING
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

// 7. MEDIA (Fixed Voice)
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

let mediaRecorder, chunks = [];

// Handle Desktop (Mouse) & Mobile (Touch)
const startRecord = async (e) => {
    if(e.type === 'mousedown' && e.button !== 0) return; // Only left click
    e.preventDefault(); 
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
    } catch(err) {
        alert("Microphone denied. Please check browser permissions.");
    }
};

const stopRecord = (e) => {
    e.preventDefault();
    if(mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        els.micBtn.classList.remove('recording');
    }
};

// Add listeners for both mouse and touch
els.micBtn.addEventListener('mousedown', startRecord);
els.micBtn.addEventListener('mouseup', stopRecord);
els.micBtn.addEventListener('touchstart', startRecord);
els.micBtn.addEventListener('touchend', stopRecord);


// 8. BUTTONS
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
els.reportBtn.addEventListener('click', () => { if(confirm("Report User?")) socket.emit('report_partner'); });
els.saveBtn.addEventListener('click', () => { html2pdf().from(els.msgs).save("chat.pdf"); });
