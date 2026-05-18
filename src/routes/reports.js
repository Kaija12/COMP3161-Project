const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');


// GET /api/reports/large-courses
// courses that have 50 or more students

router.get('/large-courses', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_large_courses ORDER BY student_count DESC');
    return res.json({ courses: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/heavy-students
// students that do 5 or more courses

router.get('/heavy-students', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_heavy_students ORDER BY course_count DESC');
    return res.json({ students: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/busy-lecturers
// lecturers that teach 3 or more courses

router.get('/busy-lecturers', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_busy_lecturers ORDER BY course_count DESC');
    return res.json({ lecturers: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/top-enrolled
// the 10 most enrolled courses

router.get('/top-enrolled', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_top_enrolled_courses');
    return res.json({ courses: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/top-students
// top 10 sstudents with the highest overall averages

router.get('/top-students', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_top_students');
    return res.json({ students: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;