const express  = require('express');
const router   = express.Router();
const pool     = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');


// POST /api/courses
// admin only; create a new course

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { course_code, course_name, description, lecturer_id } = req.body;

  if (!course_code || !course_name) {
    return res.status(400).json({ error: 'course_code and course_name are required.' });
  }

  try {
    
    if (lecturer_id) {
      const [lec] = await pool.query(
        "SELECT user_id FROM users WHERE user_id = ? AND role = 'lecturer'",
        [lecturer_id]
      );
      if (lec.length === 0) {
        return res.status(400).json({ error: 'lecturer_id does not belong to a lecturer.' });
      }

      
      const [load] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM courses WHERE lecturer_id = ?',
        [lecturer_id]
      );
      if (load[0].cnt >= 5) {
        return res.status(409).json({ error: 'Lecturer already teaches 5 courses (maximum).' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO courses (course_code, course_name, description, lecturer_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [course_code, course_name, description || null, lecturer_id || null, req.user.user_id]
    );

    return res.status(201).json({
      message:   'Course created.',
      course_id: result.insertId,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Course code already exists.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// GET /api/courses
// retrieve all courses

router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.course_id, c.course_code, c.course_name, c.description,
              c.lecturer_id, u.first_name AS lecturer_first, u.last_name AS lecturer_last,
              c.created_at
       FROM courses c
       LEFT JOIN users u ON c.lecturer_id = u.user_id
       ORDER BY c.course_id`
    );
    return res.json({ courses: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// GET /api/courses/student/:student_id
// courses a particular student is enrolled in

router.get('/student/:student_id', authenticate, async (req, res) => {
  const { student_id } = req.params;

  
  if (req.user.role === 'student' && req.user.user_id !== parseInt(student_id)) {
    return res.status(403).json({ error: 'You can only view your own courses.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT c.course_id, c.course_code, c.course_name, c.description,
              u.first_name AS lecturer_first, u.last_name AS lecturer_last,
              e.enrolled_at
       FROM course_enrollments e
       JOIN courses c ON e.course_id = c.course_id
       LEFT JOIN users u ON c.lecturer_id = u.user_id
       WHERE e.student_id = ?
       ORDER BY c.course_name`,
      [student_id]
    );
    return res.json({ courses: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// GET /api/courses/lecturer/:lecturer_id
// courses taught by a particular lecturer

router.get('/lecturer/:lecturer_id', authenticate, async (req, res) => {
  const { lecturer_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT c.course_id, c.course_code, c.course_name, c.description, c.created_at
       FROM courses c
       WHERE c.lecturer_id = ?
       ORDER BY c.course_name`,
      [lecturer_id]
    );
    return res.json({ courses: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// GET /api/courses/:course_id
// single course details

router.get('/:course_id', authenticate, async (req, res) => {
  const { course_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT c.course_id, c.course_code, c.course_name, c.description,
              c.lecturer_id, u.first_name AS lecturer_first, u.last_name AS lecturer_last,
              u.email AS lecturer_email, c.created_at
       FROM courses c
       LEFT JOIN users u ON c.lecturer_id = u.user_id
       WHERE c.course_id = ?`,
      [course_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Course not found.' });
    }
    return res.json({ course: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// POST /api/courses/:course_id/enroll
// students enroll in a course; admins can also assign a lecturer

router.post('/:course_id/enroll', authenticate, async (req, res) => {
  const { course_id } = req.params;
  const { lecturer_id } = req.body;

  try {
    
    const [course] = await pool.query(
      'SELECT course_id, lecturer_id FROM courses WHERE course_id = ?',
      [course_id]
    );
    if (course.length === 0) {
      return res.status(404).json({ error: 'Course not found.' });
    }
    
    if (req.user.role === 'admin' && lecturer_id) {
      const [lec] = await pool.query(
        "SELECT user_id FROM users WHERE user_id = ? AND role = 'lecturer'",
        [lecturer_id]
      );
      if (lec.length === 0) {
        return res.status(400).json({ error: 'lecturer_id does not belong to a lecturer.' });
      }
      if (course[0].lecturer_id) {
        return res.status(409).json({ error: 'Course already has a lecturer assigned.' });
      }
      await pool.query(
        'UPDATE courses SET lecturer_id = ? WHERE course_id = ?',
        [lecturer_id, course_id]
      );
      return res.json({ message: 'Lecturer assigned to course.' });
    }

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can self-enroll.' });
    }

    const student_id = req.user.user_id;

    const [load] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM course_enrollments WHERE student_id = ?',
      [student_id]
    );
    if (load[0].cnt >= 6) {
      return res.status(409).json({ error: 'You are already enrolled in the maximum of 6 courses.' });
    }

    await pool.query(
      'INSERT INTO course_enrollments (course_id, student_id) VALUES (?, ?)',
      [course_id, student_id]
    );

    return res.status(201).json({ message: 'Enrolled successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Already enrolled in this course.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// GET /api/courses/:course_id/members
// all enrolled students and assigned lecturer for a course

router.get('/:course_id/members', authenticate, async (req, res) => {
  const { course_id } = req.params;
  try {
    const [students] = await pool.query(
      `SELECT u.user_id, u.username, u.first_name, u.last_name, u.email, e.enrolled_at
       FROM course_enrollments e
       JOIN users u ON e.student_id = u.user_id
       WHERE e.course_id = ?
       ORDER BY u.last_name, u.first_name`,
      [course_id]
    );

    const [lecturer] = await pool.query(
      `SELECT u.user_id, u.username, u.first_name, u.last_name, u.email
       FROM courses c
       JOIN users u ON c.lecturer_id = u.user_id
       WHERE c.course_id = ?`,
      [course_id]
    );

    return res.json({
      lecturer: lecturer[0] || null,
      students,
      total_students: students.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;