const express = require('express');
const router = express.Router();

const pool = require('../db/pool');
const cache = require('../services/cache');

const getPagination = require('../utils/pagination');

const { authenticate, authorize } = require('../middleware/auth');


// CREATE COURSE

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const {
    course_code,
    course_name,
    description,
    lecturer_id
  } = req.body;

  if (!course_code || !course_name) {
    return res.status(400).json({
      error: 'course_code and course_name are required.'
    });
  }

  try {

    if (lecturer_id) {

      const [lecturer] = await pool.query(
        `SELECT user_id
         FROM users
         WHERE user_id = ?
         AND role = 'lecturer'`,
        [lecturer_id]
      );

      if (!lecturer.length) {
        return res.status(400).json({
          error: 'Invalid lecturer_id.'
        });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO courses
      (
        course_code,
        course_name,
        description,
        lecturer_id,
        created_by
      )
      VALUES (?, ?, ?, ?, ?)`,
      [
        course_code,
        course_name,
        description || null,
        lecturer_id || null,
        req.user.user_id
      ]
    );

    await cache.del('courses:*');

    res.status(201).json({
      message: 'Course created.',
      course_id: result.insertId
    });

  } catch (err) {

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'Course code already exists.'
      });
    }

    console.error(err);

    res.status(500).json({
      error: 'Server error.'
    });
  }
});


// GET ALL COURSES WITH PAGINATION + CACHE

router.get('/', authenticate, async (req, res) => {

  const { page, limit, offset } = getPagination(req);

  const cacheKey = `courses:${page}:${limit}`;

  try {

    const cached = await cache.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const [rows] = await pool.query(
      `SELECT
        c.course_id,
        c.course_code,
        c.course_name,
        c.description,
        c.created_at,
        u.first_name AS lecturer_first,
        u.last_name AS lecturer_last
      FROM courses c
      LEFT JOIN users u
        ON c.lecturer_id = u.user_id
      ORDER BY c.course_id DESC
      LIMIT ?
      OFFSET ?`,
      [limit, offset]
    );

    const [[total]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM courses`
    );

    const response = {
      page,
      limit,
      total: total.total,
      totalPages: Math.ceil(total.total / limit),
      courses: rows
    };

    await cache.setEx(
      cacheKey,
      60,
      JSON.stringify(response)
    );

    res.json(response);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Server error.'
    });
  }
});


// SINGLE COURSE

router.get('/:course_id', authenticate, async (req, res) => {

  try {

    const [rows] = await pool.query(
      `SELECT
        c.course_id,
        c.course_code,
        c.course_name,
        c.description,
        c.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM courses c
      LEFT JOIN users u
        ON c.lecturer_id = u.user_id
      WHERE c.course_id = ?`,
      [req.params.course_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'Course not found.'
      });
    }

    res.json(rows[0]);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Server error.'
    });
  }
});

module.exports = router;