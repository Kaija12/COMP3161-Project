const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');


// POST /api/courses/:course_id/events
// lecturer or admin creates a calendar event

router.post('/:course_id/events', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  const { course_id } = req.params;
  const { title, description, event_date, end_date } = req.body;

  if (!title || !event_date) {
    return res.status(400).json({ error: 'title and event_date are required.' });
  }

  try {
    
    if (req.user.role === 'lecturer') {
      const [course] = await pool.query(
        'SELECT lecturer_id FROM courses WHERE course_id = ?',
        [course_id]
      );
      if (course.length === 0) return res.status(404).json({ error: 'Course not found.' });
      if (course[0].lecturer_id !== req.user.user_id) {
        return res.status(403).json({ error: 'You are not the lecturer for this course.' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO calendar_events (course_id, title, description, event_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [course_id, title, description || null, event_date, end_date || null, req.user.user_id]
    );

    return res.status(201).json({ message: 'Event created.', event_id: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// GET /api/courses/:course_id/events
// all calendar events for a course

router.get('/:course_id/events', authenticate, async (req, res) => {
  const { course_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT event_id, course_id, title, description, event_date, end_date, created_by
       FROM calendar_events
       WHERE course_id = ?
       ORDER BY event_date`,
      [course_id]
    );
    return res.json({ events: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// GET /api/events/student/:student_id?date=YYYY-MM-DD
// all events for a student's enrolled courses on a given date

router.get('/student/:student_id', authenticate, async (req, res) => {
  const { student_id } = req.params;
  const { date }       = req.query;

  if (req.user.role === 'student' && req.user.user_id !== parseInt(student_id)) {
    return res.status(403).json({ error: 'You can only view your own events.' });
  }

  try {
    let query = `
      SELECT ce.event_id, ce.course_id, c.course_name, ce.title,
             ce.description, ce.event_date, ce.end_date
      FROM calendar_events ce
      JOIN courses c ON ce.course_id = c.course_id
      JOIN course_enrollments e ON ce.course_id = e.course_id
      WHERE e.student_id = ?
    `;
    const params = [student_id];

    if (date) {
      query += ' AND DATE(ce.event_date) = ?';
      params.push(date);
    }

    query += ' ORDER BY ce.event_date';

    const [rows] = await pool.query(query, params);
    return res.json({ events: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;