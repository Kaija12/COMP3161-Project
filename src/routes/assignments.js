const express = require('express');
const router  = express.Router({ mergeParams: true });
const pool    = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');


// GET /api/courses/:course_id/assignments
// all assignments for a course

router.get('/', authenticate, async (req, res) => {
  const { course_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT a.assignment_id, a.title, a.description, a.due_date, a.max_grade, a.created_by
       FROM assignments a
       WHERE a.course_id = ?
       ORDER BY a.due_date`,
      [course_id]
    );
    return res.json({ assignments: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/courses/:course_id/assignments
// lecturer or admin creates an assignment

router.post('/', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  const { course_id } = req.params;
  const { title, description, due_date, max_grade = 100.00 } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required.' });

  try {
    if (req.user.role === 'lecturer') {
      const [course] = await pool.query(
        'SELECT lecturer_id FROM courses WHERE course_id = ?', [course_id]
      );
      if (!course.length || course[0].lecturer_id !== req.user.user_id) {
        return res.status(403).json({ error: 'You are not the lecturer for this course.' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO assignments (course_id, created_by, title, description, due_date, max_grade)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [course_id, req.user.user_id, title, description || null, due_date || null, max_grade]
    );
    return res.status(201).json({ message: 'Assignment created.', assignment_id: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// POST /api/courses/:course_id/assignments/:assignment_id/submit
// student submits an assignment

router.post('/:assignment_id/submit', authenticate, authorize('student'), async (req, res) => {
  const { assignment_id }  = req.params;
  const { submission_url } = req.body;

  try {
    const [asgn] = await pool.query(
      'SELECT assignment_id FROM assignments WHERE assignment_id = ?', [assignment_id]
    );
    if (asgn.length === 0) return res.status(404).json({ error: 'Assignment not found.' });

    const [result] = await pool.query(
      `INSERT INTO submissions (assignment_id, student_id, submission_url)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE submission_url = VALUES(submission_url), submitted_at = CURRENT_TIMESTAMP`,
      [assignment_id, req.user.user_id, submission_url || null]
    );

    return res.status(201).json({
      message:       'Submission recorded.',
      submission_id: result.insertId || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/courses/:course_id/assignments/:assignment_id/submissions
// lecturer/admin views all submissions for an assignment

router.get('/:assignment_id/submissions', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  const { assignment_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT s.submission_id, s.student_id, u.username, u.first_name, u.last_name,
              s.submission_url, s.submitted_at, s.grade, s.graded_at
       FROM submissions s
       JOIN users u ON s.student_id = u.user_id
       WHERE s.assignment_id = ?
       ORDER BY s.submitted_at`,
      [assignment_id]
    );
    return res.json({ submissions: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// PATCH /api/courses/:course_id/assignments/:assignment_id/submissions/:student_id/grade
// A lecturer can submit a grade for a particular student for that assignment.

router.patch('/:assignment_id/submissions/:student_id/grade',
  authenticate, authorize('admin', 'lecturer'),
  async (req, res) => {
    const { assignment_id, student_id } = req.params;
    const { grade }                     = req.body;

    if (grade === undefined || grade === null) {
      return res.status(400).json({ error: 'grade is required.' });
    }
    if (isNaN(grade) || grade < 0) {
      return res.status(400).json({ error: 'grade must be a non-negative number.' });
    }

    try {
      const [result] = await pool.query(
        `UPDATE submissions
         SET grade = ?, graded_at = CURRENT_TIMESTAMP, graded_by = ?
         WHERE assignment_id = ? AND student_id = ?`,
        [grade, req.user.user_id, assignment_id, student_id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Submission not found for this student and assignment.' });
      }

      return res.json({ message: 'Grade submitted.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
);

// GET /api/courses/:course_id/grades/:student_id
// student's grades across all assignments in a course

router.get('/../grades/:student_id', authenticate, async (req, res) => {
  const { course_id, student_id } = req.params;

  if (req.user.role === 'student' && req.user.user_id !== parseInt(student_id)) {
    return res.status(403).json({ error: 'You can only view your own grades.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT a.assignment_id, a.title, a.max_grade, a.due_date,
              s.grade, s.submitted_at, s.graded_at
       FROM assignments a
       LEFT JOIN submissions s ON a.assignment_id = s.assignment_id AND s.student_id = ?
       WHERE a.course_id = ?
       ORDER BY a.due_date`,
      [student_id, course_id]
    );

    const graded   = rows.filter(r => r.grade !== null);
    const avg      = graded.length
      ? (graded.reduce((sum, r) => sum + parseFloat(r.grade), 0) / graded.length).toFixed(2)
      : null;

    return res.json({ grades: rows, average: avg });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;