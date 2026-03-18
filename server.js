import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Per-room state: keyed by room password
// { [roomId]: { objects: [], users: {}, messages: [] } }
const rooms = {};

function getRoom(roomId) {
  const normalizedId = (roomId || '').trim().toLowerCase();
  if (!rooms[normalizedId]) {
    rooms[normalizedId] = { objects: [], users: {}, messages: [] };
  }
  return rooms[normalizedId];
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Track which room this socket belongs to
  let currentRoom = null;

  socket.on('join-room', ({ name, room }) => {
    // Default room if no password provided (normalize for consistency)
    const roomId = (room || '__default__').trim().toLowerCase();
    currentRoom = roomId;

    // Join Socket.IO room for targeted broadcasting
    socket.join(roomId);

    // Register user in this room
    const roomState = getRoom(roomId);
    roomState.users[socket.id] = { id: socket.id, name };

    // Send the current whiteboard state to the newly joined user
    socket.emit('init-sync', {
      objects: roomState.objects,
      users: Object.values(roomState.users),
      messages: roomState.messages
    });

    // Notify all users in the room of the updated user list
    const roomUsers = Object.values(roomState.users);
    io.to(roomId).emit('users-updated', roomUsers);
    console.log(`[Join] User "${name}" (${socket.id}) joined room "${roomId}". Total users in room: ${roomUsers.length}`);
  });

  // New drawing object
  socket.on('draw-object', (obj) => {
    if (!currentRoom) return;
    const roomState = getRoom(currentRoom);
    roomState.objects.push(obj);
    socket.to(currentRoom).emit('new-object', obj);
    console.log(`[Draw] New object ${obj.id} (type: ${obj.type}) from ${socket.id} in room "${currentRoom}"`);
  });

  // Cursor movement
  socket.on('cursor-move', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('cursor-updated', {
      id: socket.id,
      ...data
    });
  });

  // Object moved/updated
  socket.on('update-object', (updatedObj) => {
    if (!currentRoom) return;
    const roomState = getRoom(currentRoom);
    const idx = roomState.objects.findIndex(o => o.id === updatedObj.id);
    if (idx !== -1) {
      roomState.objects[idx] = updatedObj;
      socket.to(currentRoom).emit('object-updated', updatedObj);
    }
  });

  // Object deleted
  socket.on('delete-object', (objId) => {
    if (!currentRoom) return;
    const roomState = getRoom(currentRoom);
    roomState.objects = roomState.objects.filter(o => o.id !== objId);
    socket.to(currentRoom).emit('object-deleted', objId);
  });

  // Clear the board for this room
  socket.on('clear-board', () => {
    if (!currentRoom) {
      console.warn(`Attempted clear-board from socket ${socket.id} with no currentRoom`);
      return;
    }
    console.log(`Clearing board for room: ${currentRoom}`);
    const roomState = getRoom(currentRoom);
    roomState.objects = [];
    io.to(currentRoom).emit('board-cleared');
  });

  // Chat message
  socket.on('send-message', (msg) => {
    if (!currentRoom) {
      console.warn(`[Chat] Attempted to send message from socket ${socket.id} with no currentRoom`);
      return;
    }
    console.log(`[Chat] Message in room "${currentRoom}" from "${msg.senderName}": ${msg.text}`);
    const roomState = getRoom(currentRoom);
    roomState.messages.push(msg);
    if (roomState.messages.length > 100) roomState.messages.shift();
    io.to(currentRoom).emit('new-message', msg);
    console.log(`[Chat] Message broadcast to room "${currentRoom}" from "${msg.senderName}" (${socket.id})`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (!currentRoom) return;
    const roomState = getRoom(currentRoom);
    delete roomState.users[socket.id];
    io.to(currentRoom).emit('users-updated', Object.values(roomState.users));

    // Clean up empty rooms to avoid memory leaks
    if (
      Object.keys(roomState.users).length === 0 &&
      roomState.objects.length === 0 &&
      roomState.messages.length === 0
    ) {
      delete rooms[currentRoom];
      console.log(`Room "${currentRoom}" cleaned up (empty).`);
    }
  });
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`Whiteboard sync server running on ${HOST}:${PORT}`);
});
