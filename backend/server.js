require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./config/db');

const authRoutes       = require('./routes/auth');
const branchRoutes     = require('./routes/branches');
const userRoutes       = require('./routes/users');
const attendanceRoutes = require('./routes/attendance');
const scheduleRoutes   = require('./routes/schedules');
const securityRoutes   = require('./routes/security');

const app = express();

function normalizePrefix(value, fallback) {
  const raw = (value ?? fallback ?? '').toString().trim();
  if (!raw) return '';
  if (raw === '/') return '';
  return raw.startsWith('/') ? raw.replace(/\/$/, '') : `/${raw.replace(/\/$/, '')}`;
}

// Default: expose routes under /api/*
// If you mount the Node app at /api in cPanel, set API_PREFIX='' so URLs become /api/<route>
const API_PREFIX = normalizePrefix(process.env.API_PREFIX, '/api');

app.use(cors({
  origin: [
    process.env.ADMIN_FRONTEND_URL || 'http://localhost:5173',
    process.env.USER_FRONTEND_URL  || 'http://localhost:5174'
  ],
  credentials: true
}));
app.use(express.json());

app.use(`${API_PREFIX}/auth`,       authRoutes);
app.use(`${API_PREFIX}/branches`,   branchRoutes);
app.use(`${API_PREFIX}/users`,      userRoutes);
app.use(`${API_PREFIX}/attendance`, attendanceRoutes);
app.use(`${API_PREFIX}/schedules`,  scheduleRoutes);
app.use(`${API_PREFIX}/security`,   securityRoutes);

app.get(`${API_PREFIX}/health`, (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;

(async () => {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
