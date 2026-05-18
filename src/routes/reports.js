const express = require('express');
const router  = express.Router();

const pool    = require('../db/pool');
const cache   = require('../services/cache');

const { authenticate, authorize } = require('../middleware/auth');


// helper function
async function getCachedReport(key, queryFn, res) {
  try {

    const cached = await cache.get(key);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const data = await queryFn();

    await cache.setEx(key, 120, JSON.stringify(data));

    return res.json(data);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
}


// LARGE COURSES
router.get('/large-courses',
  authenticate,
  authorize('admin', 'lecturer'),
  async (req, res) => {

    const cacheKey = 'report:large-courses';

    return getCachedReport(cacheKey, async () => {

      const [rows] = await pool.query(
        `SELECT *
         FROM vw_large_courses
         ORDER BY student_count DESC`
      );

      return { courses: rows };

    }, res);
  }
);


// HEAVY STUDENTS
router.get('/heavy-students',
  authenticate,
  authorize('admin', 'lecturer'),
  async (req, res) => {

    const cacheKey = 'report:heavy-students';

    return getCachedReport(cacheKey, async () => {

      const [rows] = await pool.query(
        `SELECT *
         FROM vw_heavy_students
         ORDER BY course_count DESC`
      );

      return { students: rows };

    }, res);
  }
);


// BUSY LECTURERS
router.get('/busy-lecturers',
  authenticate,
  authorize('admin', 'lecturer'),
  async (req, res) => {

    const cacheKey = 'report:busy-lecturers';

    return getCachedReport(cacheKey, async () => {

      const [rows] = await pool.query(
        `SELECT *
         FROM vw_busy_lecturers
         ORDER BY course_count DESC`
      );

      return { lecturers: rows };

    }, res);
  }
);


// TOP ENROLLED
router.get('/top-enrolled',
  authenticate,
  authorize('admin', 'lecturer'),
  async (req, res) => {

    const cacheKey = 'report:top-enrolled';

    return getCachedReport(cacheKey, async () => {

      const [rows] = await pool.query(
        `SELECT * FROM vw_top_enrolled_courses`
      );

      return { courses: rows };

    }, res);
  }
);


// TOP STUDENTS
router.get('/top-students',
  authenticate,
  authorize('admin', 'lecturer'),
  async (req, res) => {

    const cacheKey = 'report:top-students';

    return getCachedReport(cacheKey, async () => {

      const [rows] = await pool.query(
        `SELECT * FROM vw_top_students`
      );

      return { students: rows };

    }, res);
  }
);

module.exports = router;