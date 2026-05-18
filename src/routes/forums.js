const express = require('express');
const router = express.Router({ mergeParams: true });

const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

function getPagination(req) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

router.get('/:forum_id/threads', authenticate, async (req, res) => {
  const { forum_id } = req.params;
  const { limit, offset } = getPagination(req);

  try {
    const [rows] = await pool.query(
      `SELECT
        t.thread_id,
        t.title,
        t.created_at,
        u.username,
        COUNT(r.reply_id) AS reply_count
       FROM threads t
       JOIN users u ON t.author_id = u.user_id
       LEFT JOIN replies r ON t.thread_id = r.thread_id
       WHERE t.forum_id = ?
       GROUP BY t.thread_id
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [forum_id, limit, offset]
    );

    return res.json({ threads: rows });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;