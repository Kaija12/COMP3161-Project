require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes        = require('./routes/auth');
const courseRoutes      = require('./routes/courses');
const eventRoutes       = require('./routes/events');
const forumRoutes       = require('./routes/forums');
const contentRoutes     = require('./routes/content');
const assignmentRoutes  = require('./routes/assignments');
const reportRoutes      = require('./routes/reports');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);

app.use('/api/courses', eventRoutes); 

app.use('/api/courses/:course_id/forums', forumRoutes);
app.use('/api/courses/:course_id/content', contentRoutes);
app.use('/api/courses/:course_id/assignments', assignmentRoutes);

app.use('/api/reports', reportRoutes);


app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});


app.listen(PORT, () => {
  console.log(`\n  Course Management API running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health\n`);
});

app.use(express.json({
  limit: '10mb'
}));

console.log('authRoutes', authRoutes);
console.log('courseRoutes', courseRoutes);
console.log('eventRoutes', eventRoutes);
console.log('forumRoutes', forumRoutes);
console.log('contentRoutes', contentRoutes);
console.log('assignmentRoutes', assignmentRoutes);
console.log('reportRoutes', reportRoutes);

module.exports = app;