import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // for development we allow all
    methods: ['GET', 'POST']
  }
});

// Store current whiteboard state in memory
let whiteboardObjects = [];
let activeUsers = {};
let messages = [];

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send the current state of the whiteboard and messages to the newly connected user
  socket.emit('init-sync', {
    objects: whiteboardObjects,
    users: Object.values(activeUsers),
    messages: messages
  });

  socket.on('join-room', (user) => {
    activeUsers[socket.id] = { id: socket.id, ...user };
    io.emit('users-updated', Object.values(activeUsers));
  });

  // Listen for a new drawing object
  socket.on('draw-object', (obj) => {
    whiteboardObjects.push(obj);
    // Broadcast the new object to all OTHER clients
    socket.broadcast.emit('new-object', obj);
  });

  // Listen for object updates (e.g. while moving/dragging)
  socket.on('update-object', (updatedObj) => {
    const idx = whiteboardObjects.findIndex(o => o.id === updatedObj.id);
    if (idx !== -1) {
      whiteboardObjects[idx] = updatedObj;
      socket.broadcast.emit('object-updated', updatedObj);
    }
  });

  // Listen for deleted objects
  socket.on('delete-object', (objId) => {
    whiteboardObjects = whiteboardObjects.filter(o => o.id !== objId);
    socket.broadcast.emit('object-deleted', objId);
  });

  // Listen for clear board command
  socket.on('clear-board', () => {
    whiteboardObjects = [];
    io.emit('board-cleared'); // emit to ALL clients, including sender
  });

  // Chat message
  socket.on('send-message', (msg) => {
    messages.push(msg);
    // Keep only last 100 messages in memory to avoid leaking
    if (messages.length > 100) messages.shift();
    io.emit('new-message', msg);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    delete activeUsers[socket.id];
    io.emit('users-updated', Object.values(activeUsers));
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Whiteboard sync server running on port ${PORT}`);
});
