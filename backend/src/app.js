const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const protectedRoutes = require('./routes/protectedRoutes');
const mcRoutes = require('./routes/mcRoutes');
const gembaRoutes = require('./routes/gembaRoutes');
const checklistRoutes = require('./routes/checklistRoutes');
const notificacionRoutes = require('./routes/notificacionRoutes');
const slamRoutes = require('./routes/slamRoutes');
const safetyRoutes = require('./routes/safetyRoutes');
const safetyEvidenceRoutes = require(
  './routes/safetyEvidenceRoutes'
);

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  '/uploads/safety',
  safetyEvidenceRoutes
);

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'))
);

app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/mc', mcRoutes);
app.use('/api/gemba', gembaRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/slam', slamRoutes);
app.use('/api/safety', safetyRoutes);

module.exports = app;
