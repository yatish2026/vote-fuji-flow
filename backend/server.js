const express = require('express');
const cors = require('cors');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config();

// MongoDB connection
const connectDB = require('./config/database');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const govtAdminRoutes = require('./routes/govtAdmin');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize MongoDB connection
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});+



// Routes
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/govt-admin', govtAdminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    network: 'avalanche-fuji',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve static files from React build (for production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server gracefully...');
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 Avalanche Voting Backend Server Started
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🔗 Network: Avalanche Fuji Testnet
📋 Contract: ${process.env.CONTRACT_ADDRESS || '0xa982db91EaF445C7928d30e37FfE4575125F8523'}

Available endpoints:
BLOCKCHAIN ENDPOINTS:
- GET  /api/health
- GET  /api/candidates  
- GET  /api/status
- GET  /api/results

CORE WALLET ADMIN ENDPOINTS:
- POST /api/admin/nonce
- POST /api/admin/auth
- GET  /api/analytics (admin)
- POST /api/admin/end-election (admin)
- GET  /api/admin/export (admin)

GOVERNMENT ID AUTH ENDPOINTS:
- POST /api/auth/register
- POST /api/auth/login
- GET  /api/auth/profile
- GET  /api/auth/users (admin)

GOVERNMENT ID ADMIN ENDPOINTS:
- GET  /api/govt-admin/analytics
- GET  /api/govt-admin/dashboard
- POST /api/govt-admin/manage-election
  `);
});

module.exports = app;