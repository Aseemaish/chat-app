const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

// --- SAFE LIBRARIES IMPORT ---
let filter, geoip;
try { filter = require('leo-profanity'); } catch(e) { console.log("Profanity filter disabled"); }
try { geoip = require('geoip-lite'); } catch(e) { console.log("GeoIP disabled"); }

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 }); // 10MB limit

app.use(express.static(path.join(__dirname, 'public')));

// Global Variables
const bannedIPs = new Set();
const reportedIPs = new Map();
let waitingUsers = [];

// Helper: Get Flag
function getFlagEmoji(ip) {
    if (!geoip) return "🌍"; // Fallback
    const geo = geoip.lookup(ip);
    return geo ? geo.country.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397)) : "🌍";
}

io.on('connection', (socket) => {
    const userIP = socket.handshake.address;

    if (bannedIPs.has(userIP)) {
        socket.emit('banned', 'You are banned.');
        socket.disconnect();
        return;
    }

    // Update Online Count
    io.emit('online_count', io.engine.clientsCount);

    socket.on('user_login', (data) => {
        if(!data.name || !data.age) return;

        socket.userData = {
            id: socket.id,
            name: data.name,
            age: parseInt(data.age),
            interests: data.interests || [],
            country: getFlagEmoji(userIP),
            ip: userIP,
            room: null
        };
        
        findMatch(socket);
    });

    function findMatch(socket) {
        // Priority 1: Interests
        let matchIndex = -1;
        if (socket.userData.interests.length > 0) {
            matchIndex = waitingUsers.findIndex(u => 
                u.id !== socket.id && 
                u.userData.interests.some(i => socket.userData.interests.includes(i))
            );
        }

        // Priority 2: Random
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

            io.to(roomName).emit('chat_start', { room: roomName });
            
            // Exchange Details
            socket.emit('system_message', `Matched: ${partner.userData.country} ${partner.userData.name} (${partner.userData.age})`);
            partner.emit('system_message', `Matched: ${socket.userData.country} ${socket.userData.name} (${socket.userData.age})`);
        } else {
            waitingUsers.push(socket);
            socket.emit('status', 'Searching for partner...');
        }
    }

    // --- CHAT EVENTS ---
    socket.on('send_message', (data) => {
        if(!socket.userData.room) return;
        let clean = data.message;
        if(filter) clean = filter.clean(data.message);
        
        socket.to(socket.userData.room).emit('receive_message', {
            type: 'text', content: clean, time: new Date().toLocaleTimeString()
        });
    });

    socket.on('send_image', (data) => {
        if(!socket.userData.room) return;
        socket.to(socket.userData.room).emit('receive_message', {
            type: 'image', content: data.image, time: new Date().toLocaleTimeString()
        });
    });

    socket.on('send_voice', (data) => {
        if(!socket.userData.room) return;
        socket.to(socket.userData.room).emit('receive_message', {
            type: 'audio', content: data.buffer, time: new Date().toLocaleTimeString()
        });
    });

    socket.on('typing', () => {
        if(socket.userData.room) socket.to(socket.userData.room).emit('partner_typing');
    });

    socket.on('stop_typing', () => {
        if(socket.userData.room) socket.to(socket.userData.room).emit('partner_stop_typing');
    });

    // --- ACTIONS ---
    socket.on('report_partner', () => {
        if(!socket.userData.room) return;
        // Logic to report partner IP...
        socket.emit('system_message', 'Report received.');
    });

    socket.on('skip_partner', () => {
        cleanup(socket);
        findMatch(socket);
    });

    socket.on('leave_chat', () => {
        cleanup(socket);
    });

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
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));