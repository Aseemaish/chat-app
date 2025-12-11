const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

// Safe Import for Profanity Filter
let filter;
try { filter = require('leo-profanity'); } catch(e) {}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 }); // 10MB limit

app.use(express.static(path.join(__dirname, 'public')));

// Global Variables
const bannedIPs = new Set();
let waitingUsers = [];

io.on('connection', (socket) => {
    const userIP = socket.handshake.address;

    if (bannedIPs.has(userIP)) {
        socket.emit('banned', 'You are banned.');
        socket.disconnect();
        return;
    }

    io.emit('online_count', io.engine.clientsCount);

    socket.on('user_login', (data) => {
        if(!data.name || !data.age) return;

        socket.userData = {
            id: socket.id,
            name: data.name,
            age: parseInt(data.age),
            country: data.country || "🌍",
            interests: data.interests || [],
            room: null
        };
        
        findMatch(socket);
    });

    function findMatch(socket) {
        let matchIndex = -1;
        
        // 1. Interest Match
        if (socket.userData.interests.length > 0) {
            matchIndex = waitingUsers.findIndex(u => 
                u.id !== socket.id && 
                u.userData.interests.some(i => socket.userData.interests.includes(i))
            );
        }

        // 2. Random Match
        if (matchIndex === -1) {
            matchIndex = waitingUsers.findIndex(u => u.id !== socket.id);
        }

        if (matchIndex > -1) {
            const partner = waitingUsers.splice(matchIndex, 1)[0];
            const roomName = `room_${partner.id}_${socket.id}`;

            socket.join(roomName);
            partner.join(roomName);
            
            socket.userData.room = roomName;
            partner.userData.room = roomName;

            // Send Partner Details
            io.to(socket.id).emit('chat_start', { 
                room: roomName, 
                partner: { name: partner.userData.name, country: partner.userData.country } 
            });
            
            io.to(partner.id).emit('chat_start', { 
                room: roomName, 
                partner: { name: socket.userData.name, country: socket.userData.country } 
            });
            
            // System Messages
            socket.emit('system_message', `Matched with: ${partner.userData.country} ${partner.userData.name}`);
            partner.emit('system_message', `Matched with: ${socket.userData.country} ${socket.userData.name}`);
        } else {
            waitingUsers.push(socket);
            socket.emit('status', 'Searching for a partner...');
        }
    }

    // --- CHAT LOGIC ---
    socket.on('send_message', (data) => {
        if(!socket.userData.room) return;
        let clean = filter ? filter.clean(data.message) : data.message;
        socket.to(socket.userData.room).emit('receive_message', { type: 'text', content: clean });
    });

    socket.on('send_image', (data) => {
        if(!socket.userData.room) return;
        socket.to(socket.userData.room).emit('receive_message', { type: 'image', content: data.image });
    });

    socket.on('send_voice', (data) => {
        if(!socket.userData.room) return;
        socket.to(socket.userData.room).emit('receive_message', { type: 'audio', content: data.buffer });
    });

    socket.on('typing', () => {
        if(socket.userData.room) socket.to(socket.userData.room).emit('partner_typing');
    });
    socket.on('stop_typing', () => {
        if(socket.userData.room) socket.to(socket.userData.room).emit('partner_stop_typing');
    });

    // --- ACTIONS ---
    socket.on('skip_partner', () => { cleanup(socket); findMatch(socket); });
    socket.on('leave_chat', () => { cleanup(socket); });
    socket.on('report_partner', () => { socket.emit('system_message', 'User reported to admin.'); });

    socket.on('disconnect', () => {
        cleanup(socket);
        io.emit('online_count', io.engine.clientsCount);
    });

    function cleanup(socket) {
        waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
        if (socket.userData && socket.userData.room) {
            socket.to(socket.userData.room).emit('partner_left');
            socket.leave(socket.userData.room);
            socket.userData.room = null;
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
