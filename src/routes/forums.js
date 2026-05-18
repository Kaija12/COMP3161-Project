const express = require('express');
const router = express.Router({ mergeParams: true });

const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/:forum_id/threads', authenticate, async (req, res) => {

  const { page, limit, offset } = getPagination(req);

  try {

    const [rows] = await pool.query(
      `SELECT
        t.thread_id,
        t.title,
        t.created_at,
        u.username,
        COUNT(r.reply_id) AS reply_count
      FROM threads t
      JOIN users u
        ON t.author_id = u.user_id
      LEFT JOIN replies r
        ON t.thread_id = r.thread_id
      WHERE t.forum_id = ?
      GROUP BY t.thread_id
      ORDER BY t.created_at DESC
      LIMIT ?
      OFFSET ?`,
      [req.params.forum_id, limit, offset]
    );

    res.json(rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Server error.'
    });
  }
});