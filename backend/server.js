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

app.use(cors({
  origin: [
    process.env.ADMIN_FRONTEND_URL || 'http://localhost:5173',
    process.env.USER_FRONTEND_URL  || 'http://localhost:5174'
  ],
  credentials: true
}));
app.use(express.json());

app.use('/api/auth',       authRoutes);
app.use('/api/branches',   branchRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/schedules',  scheduleRoutes);
app.use('/api/security',   securityRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;

(async () => {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
