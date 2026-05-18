const express = require('express');
const router  = express.Router({ mergeParams: true });

const pool  = require('../db/pool');
const cache = require('../services/cache');

const { authenticate, authorize } = require('../middleware/auth');


// ======================================================
// CREATE EVENT
// ======================================================
router.post('/:course_id/events',
  authenticate,
  authorize('admin', 'lecturer'),
  async (req, res) => {

    const { course_id } = req.params;
    const { title, description, event_date, end_date } = req.body;

    if (!course_id || isNaN(course_id)) {
      return res.status(400).json({ error: 'Invalid course_id.' });
    }

    if (!title || !event_date) {
      return res.status(400).json({
        error: 'title and event_date are required.'
      });
    }

    try {

      // lecturer ownership check
      if (req.user.role === 'lecturer') {

        const [course] = await pool.query(
          'SELECT lecturer_id FROM courses WHERE course_id = ?',
          [course_id]
        );

        if (!course.length) {
          return res.status(404).json({ error: 'Course not found.' });
        }

        if (course[0].lecturer_id !== req.user.user_id) {
          return res.status(403).json({ error: 'Not your course.' });
        }
      }

      const [result] = await pool.query(
        `INSERT INTO calendar_events
         (course_id, title, description, event_date, end_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          course_id,
          title,
          description || null,
          event_date,
          end_date || null,
          req.user.user_id
        ]
      );

      await cache.del(`events:course:${course_id}`);

      return res.status(201).json({
        message: 'Event created',
        event_id: result.insertId
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
);


// ======================================================
// GET EVENTS (CACHED)
// ======================================================
router.get('/:course_id/events',
  authenticate,
  async (req, res) => {

    const { course_id } = req.params;
    const cacheKey = `events:course:${course_id}`;

    try {

      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const [rows] = await pool.query(
        `SELECT event_id, course_id, title,
                description, event_date, end_date, created_by
         FROM calendar_events
         WHERE course_id = ?
         ORDER BY event_date ASC`,
        [course_id]
      );

      const response = { events: rows };

      await cache.setEx(cacheKey, 60, JSON.stringify(response));

      return res.json(response);

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
);


// ======================================================
// STUDENT CALENDAR EVENTS
// ======================================================
router.get('/student/:student_id',
  authenticate,
  authorize('admin', 'lecturer', 'student'),
  async (req, res) => {

    const { student_id } = req.params;
    const { date } = req.query;

    if (!student_id || isNaN(student_id)) {
      return res.status(400).json({ error: 'Invalid student_id.' });
    }

    if (
      req.user.role === 'student' &&
      req.user.user_id !== parseInt(student_id)
    ) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    try {

      const params = [student_id];

      let query = `
        SELECT ce.event_id, ce.course_id,
               c.course_name,
               ce.title, ce.description,
               ce.event_date, ce.end_date
        FROM course_enrollments e
        JOIN calendar_events ce ON e.course_id = ce.course_id
        JOIN courses c ON ce.course_id = c.course_id
        WHERE e.student_id = ?
      `;

      if (date) {
        query += ' AND DATE(ce.event_date) = ?';
        params.push(date);
      }

      query += ' ORDER BY ce.event_date ASC';

      const [rows] = await pool.query(query, params);

      return res.json({ events: rows });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
);

module.exports = router;