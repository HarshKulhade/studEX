'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { protectStudent } = require('./middleware/auth');

// ── Route imports ────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const vendorRoutes = require('./routes/vendor.routes');
const dealRoutes = require('./routes/deal.routes');
const redemptionRoutes = require('./routes/redemption.routes');
const printRoutes = require('./routes/print.routes');
const walletRoutes = require('./routes/wallet.routes');
const opportunityRoutes = require('./routes/opportunity.routes');
const adminRoutes = require('./routes/admin.routes');

// ── App & HTTP server ─────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.IO setup ───────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(url => url.trim()) : 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in controllers via app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  // Students join a personal room identified by their userId
  socket.on('join', (userId) => {
    socket.join(userId);
  });

  socket.on('disconnect', () => {
    // cleanup handled automatically
  });
});

// ── 1. Security & utility middleware ──────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(url => url.trim()) : 'http://localhost:3000',
    credentials: true,
  })
);

// HTTP logging — only in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── 2. Rate limiting on all /api routes ──────────
app.use('/api', generalLimiter);

// ── 3. Route mounts ───────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/student', protectStudent, studentRoutes);
app.use('/api/vendor', vendorRoutes);          // vendor routes handle their own auth internally
app.use('/api/deals', dealRoutes);             // deal routes handle their own auth internally
app.use('/api/redemptions', protectStudent, redemptionRoutes);
app.use('/api/print', protectStudent, printRoutes);
app.use('/api/wallet', protectStudent, walletRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/admin', adminRoutes);

// ── 4. Health & Root check ──────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Student Super App API',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Student Super App API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── 5. 404 handler ────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ── 6. Global error handler (must be last) ────────
app.use(errorHandler);

// ── 7. Connect DB then start server ───────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    if (process.env.NODE_ENV === 'development') {
      /* eslint-disable no-console */
      console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
      console.log(`📡 Socket.IO ready`);
      /* eslint-enable no-console */
    }
  });
});

module.exports = { app, server, io };
