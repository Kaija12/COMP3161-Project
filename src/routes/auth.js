const express = require('express');
const router  = express.Router();
const crypto = require('crypto');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');

// POST /api/auth/register

router.post('/register', async (req, res) => {
  const { username, password, role, first_name, last_name, email } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password and role are required.' });
  }

  const allowedRoles = ['admin', 'lecturer', 'student'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(', ')}.` });
  }

  try {
    const [existing] = await pool.query(
      'SELECT user_id FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    const password_hash = crypto.createHash('sha256').update(password).digest('hex');

    const [result] = await pool.query(
      `INSERT INTO users (username, password_hash, role, first_name, last_name, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, password_hash, role, first_name || null, last_name || null, email || null]
    );

    return res.status(201).json({
      message: 'User registered successfully.',
      user_id: result.insertId,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
});

// POST /api/auth/login

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT user_id, username, password_hash, role, first_name, last_name FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = rows[0];
    const valid = crypto.createHash('sha256').update(password).digest('hex') === user.password_hash;
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        user_id:    user.user_id,
        username:   user.username,
        role:       user.role,
        first_name: user.first_name,
        last_name:  user.last_name,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

module.exports = router;