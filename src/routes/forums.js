const express = require('express');
const router  = express.Router({ mergeParams: true });
const pool    = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');


// GET /api/courses/:course_id/forums
// all forums for a course

router.get('/', authenticate, async (req, res) => {
  const { course_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT f.forum_id, f.title, f.description, f.created_at,
              u.username AS created_by_username,
              COUNT(t.thread_id) AS thread_count
       FROM forums f
       LEFT JOIN users u ON f.created_by = u.user_id
       LEFT JOIN threads t ON f.forum_id = t.forum_id
       WHERE f.course_id = ?
       GROUP BY f.forum_id
       ORDER BY f.created_at`,
      [course_id]
    );
    return res.json({ forums: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/courses/:course_id/forums
// lecturer or admin creates a forum

router.post('/', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  const { course_id }           = req.params;
  const { title, description }  = req.body;

  if (!title) return res.status(400).json({ error: 'title is required.' });

  try {
    const [result] = await pool.query(
      'INSERT INTO forums (course_id, title, description, created_by) VALUES (?, ?, ?, ?)',
      [course_id, title, description || null, req.user.user_id]
    );
    return res.status(201).json({ message: 'Forum created.', forum_id: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// GET /api/courses/:course_id/forums/:forum_id/threads
// all threads in a forum

router.get('/:forum_id/threads', authenticate, async (req, res) => {
  const { forum_id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT t.thread_id, t.title, t.body, t.created_at,
              u.user_id AS author_id, u.username AS author,
              COUNT(r.reply_id) AS reply_count
       FROM threads t
       JOIN users u ON t.author_id = u.user_id
       LEFT JOIN replies r ON t.thread_id = r.thread_id
       WHERE t.forum_id = ?
       GROUP BY t.thread_id
       ORDER BY t.created_at DESC`,
      [forum_id]
    );
    return res.json({ threads: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/courses/:course_id/forums/:forum_id/threads
// any authenticated user creates a thread

router.post('/:forum_id/threads', authenticate, async (req, res) => {
  const { forum_id }  = req.params;
  const { title, body } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required.' });
  }

  try {
    const [forum] = await pool.query('SELECT forum_id FROM forums WHERE forum_id = ?', [forum_id]);
    if (forum.length === 0) return res.status(404).json({ error: 'Forum not found.' });

    const [result] = await pool.query(
      'INSERT INTO threads (forum_id, author_id, title, body) VALUES (?, ?, ?, ?)',
      [forum_id, req.user.user_id, title, body]
    );
    return res.status(201).json({ message: 'Thread created.', thread_id: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// GET /api/courses/:course_id/forums/:forum_id/threads/:thread_id
// single thread with all nested replies

router.get('/:forum_id/threads/:thread_id', authenticate, async (req, res) => {
  const { thread_id } = req.params;
  try {
    const [thread] = await pool.query(
      `SELECT t.thread_id, t.title, t.body, t.created_at,
              u.user_id AS author_id, u.username AS author
       FROM threads t
       JOIN users u ON t.author_id = u.user_id
       WHERE t.thread_id = ?`,
      [thread_id]
    );
    if (thread.length === 0) return res.status(404).json({ error: 'Thread not found.' });


    const [replies] = await pool.query(
      `SELECT r.reply_id, r.parent_reply_id, r.body, r.created_at,
              u.user_id AS author_id, u.username AS author
       FROM replies r
       JOIN users u ON r.author_id = u.user_id
       WHERE r.thread_id = ?
       ORDER BY r.created_at`,
      [thread_id]
    );

    const replyMap = {};
    replies.forEach(r => { r.children = []; replyMap[r.reply_id] = r; });
    const roots = [];
    replies.forEach(r => {
      if (r.parent_reply_id && replyMap[r.parent_reply_id]) {
        replyMap[r.parent_reply_id].children.push(r);
      } else {
        roots.push(r);
      }
    });

    return res.json({ thread: thread[0], replies: roots });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/courses/:course_id/forums/:forum_id/threads/:thread_id/replies
// reply to a thread or to another reply

router.post('/:forum_id/threads/:thread_id/replies', authenticate, async (req, res) => {
  const { thread_id }                   = req.params;
  const { body, parent_reply_id = null } = req.body;

  if (!body) return res.status(400).json({ error: 'body is required.' });

  try {
    const [thread] = await pool.query('SELECT thread_id FROM threads WHERE thread_id = ?', [thread_id]);
    if (thread.length === 0) return res.status(404).json({ error: 'Thread not found.' });

    if (parent_reply_id) {
      const [parent] = await pool.query(
        'SELECT reply_id FROM replies WHERE reply_id = ? AND thread_id = ?',
        [parent_reply_id, thread_id]
      );
      if (parent.length === 0) {
        return res.status(400).json({ error: 'parent_reply_id not found in this thread.' });
      }
    }

    const [result] = await pool.query(
      'INSERT INTO replies (thread_id, parent_reply_id, author_id, body) VALUES (?, ?, ?, ?)',
      [thread_id, parent_reply_id, req.user.user_id, body]
    );
    return res.status(201).json({ message: 'Reply posted.', reply_id: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;