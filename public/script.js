const socket = io();

const els = {
    // Screens
    rejection: document.getElementById('rejection-screen'),
    landing: document.getElementById('landing-screen'),
    login: document.getElementById('login-screen'),
    chat: document.getElementById('chat-screen'),
    legalModal: document.getElementById('legal-modal'),
    
    // UI Utils
    banner: document.getElementById('connection-banner'),
    rejEmoji: document.getElementById('rejection-emoji'),
    rejText: document.getElementById('rejection-text'),
    legalText: document.getElementById('legal-text'),

    // Buttons
    enterSiteBtn: document.getElementById('enter-site-btn'),
    ageCheck: document.getElementById('age-check'),
    joinBtn: document.getElementById('join-btn'),
    sendBtn: document.getElementById('send-btn'),
    micBtn: document.getElementById('mic-btn'),
    emojiBtn: document.getElementById('emoji-btn'),
    picker: document.getElementById('emoji-picker'),
    skipBtn: document.getElementById('skip-btn'),
    endBtn: document.getElementById('end-btn'),
    reportBtn: document.getElementById('report-btn'),
    saveBtn: document.getElementById('save-btn'),
    closeLegalBtn: document.getElementById('close-legal'),
    
    // Inputs
    txtInput: document.getElementById('message-input'),
    imgInput: document.getElementById('image-input'),
    msgs: document.getElementById('messages-area'),
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

// --- 1. CONNECTION & LEGAL ---
socket.on('disconnect', () => els.banner.classList.remove('hidden'));
socket.on('connect', () => els.banner.classList.add('hidden'));

const legalContent = {
    privacy: `
        <h3 style="color:#008069; border-bottom:1px solid #ddd; padding-bottom:10px;">Privacy Policy</h3>
        <p><strong>Last Updated:</strong> January 2025</p>
        <h4>1. Information We Collect</h4>
        <p>We do <strong>not</strong> store your chat messages. Messages are ephemeral and deleted instantly upon delivery.</p>
        <ul>
            <li><strong>IP Addresses:</strong> Used temporarily for ban enforcement (RAM only).</li>
            <li><strong>Local Storage:</strong> Saves your name/age on your device for convenience.</li>
        </ul>
        <h4>2. Advertising</h4>
        <p>We use third-party vendors (Google AdSense) who use cookies to serve ads based on your visits.</p>
        <h4>3. Contact</h4>
        <p>Owner: <strong>aseemaishwarya123@gmail.com</strong></p>
    `,
    terms: `
        <h3 style="color:#d32f2f; border-bottom:1px solid #ddd; padding-bottom:10px;">Terms of Service</h3>
        <p>By using Global Chat, you agree:</p>
        <h4>1. Age Requirement</h4>
        <p>You must be <strong>18 years or older</strong>.</p>
        <h4>2. User Conduct</h4>
        <p>No illegal, threatening, or hateful content. Violators will be banned immediately.</p>
        <h4>3. Disclaimer</h4>
        <p>Service is provided "as is". We are not responsible for user-generated content.</p>
    `
};

function showLegal(type) {
    els.legalText.innerHTML = legalContent[type];
    els.legalModal.classList.remove('hidden');
}

document.querySelectorAll('#link-privacy, #link-privacy-2').forEach(b => b.addEventListener('click', () => showLegal('privacy')));
document.querySelectorAll('#link-terms, #link-terms-2').forEach(b => b.addEventListener('click', () => showLegal('terms')));
els.closeLegalBtn.addEventListener('click', () => els.legalModal.classList.add('hidden'));

// --- 2. REJECTION LOGIC ---
const cartoons = [
    { emoji: "🍼", text: "Go drink your milk!" }, { emoji: "📚", text: "Do your homework first!" },
    { emoji: "🧸", text: "Go play with your toys!" }, { emoji: "👶", text: "Baby alert! Access Denied." },
    { emoji: "🚫", text: "18+ Only. Bye bye!" }
];

els.enterSiteBtn.addEventListener('click', () => {
    if (els.ageCheck.checked) {
        els.landing.classList.add('hidden');
        els.login.classList.remove('hidden');
    } else {
        const rand = cartoons[Math.floor(Math.random() * cartoons.length)];
        els.rejEmoji.innerText = rand.emoji;
        els.rejText.innerText = rand.text;
        els.rejection.classList.remove('hidden');
        setTimeout(() => location.reload(), 2500);
    }
});

// --- 3. LOGIN & SOCKET ---
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

// --- 4. CHAT START ---
socket.on('chat_start', (data) => {
    currentRoom = data.room;
    els.login.classList.add('hidden');
    els.chat.classList.remove('hidden');
    els.msgs.innerHTML = '';
    els.pName.innerText = `${data.partner.country} ${data.partner.name}`;
    addSysMsg("Encryption active. Say Hello!");
});
socket.on('system_message', msg => addSysMsg(msg));

// --- 5. MESSAGING ---
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

// --- 6. HELPERS ---
function getCurrentTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

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

// --- 7. FEATURES ---
els.emojiBtn.addEventListener('click', () => els.picker.classList.toggle('hidden'));
els.picker.querySelectorAll('span').forEach(span => {
    span.addEventListener('click', () => {
        els.txtInput.value += span.innerText;
        els.picker.classList.add('hidden');
        els.txtInput.focus();
    });
});

els.txtInput.addEventListener('input', () => {
    if(currentRoom) socket.emit('typing');
    setTimeout(() => socket.emit('stop_typing'), 1000);
});
socket.on('partner_typing', () => els.typing.classList.remove('hidden'));
socket.on('partner_stop_typing', () => els.typing.classList.add('hidden'));
socket.on('partner_left', () => { addSysMsg("Partner disconnected."); els.pName.innerText = "Disconnected"; });

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
const startRecord = async (e) => {
    if(e.type === 'mousedown' && e.button !== 0) return;
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
    } catch(err) { alert("Microphone denied."); }
};
const stopRecord = (e) => {
    e.preventDefault();
    if(mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        els.micBtn.classList.remove('recording');
    }
};
els.micBtn.addEventListener('mousedown', startRecord);
els.micBtn.addEventListener('mouseup', stopRecord);
els.micBtn.addEventListener('touchstart', startRecord);
els.micBtn.addEventListener('touchend', stopRecord);

els.skipBtn.addEventListener('click', () => { socket.emit('skip_partner'); els.msgs.innerHTML = ''; addSysMsg("Skipped. Searching..."); });
els.endBtn.addEventListener('click', () => { socket.emit('leave_chat'); els.chat.classList.add('hidden'); els.login.classList.remove('hidden'); els.joinBtn.disabled = false; });
els.reportBtn.addEventListener('click', () => { if(confirm("Report User?")) socket.emit('report_partner'); });
els.saveBtn.addEventListener('click', () => { html2pdf().from(els.msgs).save("chat.pdf"); });
