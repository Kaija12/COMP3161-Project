const express = require('express');
const router  = express.Router({ mergeParams: true });

const pool    = require('../db/pool');
const cache   = require('../services/cache');
const { authenticate, authorize } = require('../middleware/auth');


// GET /api/courses/:course_id/content
// all sections and content items for a course (WITH CACHE)

router.get('/', authenticate, async (req, res) => {

  const { course_id } = req.params;
  const cacheKey = `content:${course_id}`;

  try {

    // 1. Check cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // 2. Get sections
    const [sections] = await pool.query(
      `SELECT section_id, title, sort_order
       FROM course_sections
       WHERE course_id = ?
       ORDER BY sort_order`,
      [course_id]
    );

    if (!sections.length) {
      const emptyResponse = { sections: [] };
      await cache.setEx(cacheKey, 60, JSON.stringify(emptyResponse));
      return res.json(emptyResponse);
    }

    const sectionIds = sections.map(s => s.section_id);
    const contentMap = {};

    // 3. Get content for sections
    const [content] = await pool.query(
      `SELECT cc.content_id, cc.section_id, cc.content_type,
              cc.title, cc.content_url, cc.created_at,
              u.username AS uploaded_by_username
       FROM course_content cc
       JOIN users u ON cc.uploaded_by = u.user_id
       WHERE cc.section_id IN (?)
       ORDER BY cc.created_at`,
      [sectionIds]
    );

    content.forEach(item => {
      if (!contentMap[item.section_id]) {
        contentMap[item.section_id] = [];
      }
      contentMap[item.section_id].push(item);
    });

    const result = sections.map(section => ({
      ...section,
      content: contentMap[section.section_id] || []
    }));

    const responsePayload = { sections: result };

    // 4. Save to cache
    await cache.setEx(cacheKey, 60, JSON.stringify(responsePayload));

    return res.json(responsePayload);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  }
});


// POST /api/courses/:course_id/content/sections
// create section (admin or lecturer)

router.post(
  '/sections',
  authenticate,
  authorize('admin', 'lecturer'),
  async (req, res) => {

    const { course_id } = req.params;
    const { title, sort_order = 0 } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required.' });
    }

    try {

      // lecturer ownership check
      if (req.user.role === 'lecturer') {

        const [course] = await pool.query(
          `SELECT lecturer_id FROM courses WHERE course_id = ?`,
          [course_id]
        );

        if (!course.length || course[0].lecturer_id !== req.user.user_id) {
          return res.status(403).json({
            error: 'You are not the lecturer for this course.'
          });
        }
      }

      const [result] = await pool.query(
        `INSERT INTO course_sections (course_id, title, sort_order)
         VALUES (?, ?, ?)`,
        [course_id, title, sort_order]
      );

      // 🔥 CACHE INVALIDATION FIX
      await cache.del(`content:${course_id}`);

      return res.status(201).json({
        message: 'Section created.',
        section_id: result.insertId
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
);


// POST /api/courses/:course_id/content/sections/:section_id/items
// add content to section

router.post(
  '/sections/:section_id/items',
  authenticate,
  authorize('admin', 'lecturer'),
  async (req, res) => {

    const { course_id, section_id } = req.params;
    const { content_type, title, content_url } = req.body;

    if (!content_type || !title || !content_url) {
      return res.status(400).json({
        error: 'content_type, title and content_url are required.'
      });
    }

    const validTypes = ['link', 'file', 'slide'];
    if (!validTypes.includes(content_type)) {
      return res.status(400).json({
        error: `content_type must be one of: ${validTypes.join(', ')}.`
      });
    }

    try {

      // lecturer ownership check
      if (req.user.role === 'lecturer') {

        const [course] = await pool.query(
          `SELECT lecturer_id FROM courses WHERE course_id = ?`,
          [course_id]
        );

        if (!course.length || course[0].lecturer_id !== req.user.user_id) {
          return res.status(403).json({
            error: 'You are not the lecturer for this course.'
          });
        }
      }

      // verify section belongs to course
      const [sectionCheck] = await pool.query(
        `SELECT section_id
         FROM course_sections
         WHERE section_id = ?
         AND course_id = ?`,
        [section_id, course_id]
      );

      if (!sectionCheck.length) {
        return res.status(400).json({
          error: 'Invalid section for this course.'
        });
      }

      const [result] = await pool.query(
        `INSERT INTO course_content
         (section_id, uploaded_by, content_type, title, content_url)
         VALUES (?, ?, ?, ?, ?)`,
        [
          section_id,
          req.user.user_id,
          content_type,
          title,
          content_url
        ]
      );

      // 🔥 CACHE INVALIDATION FIX
      await cache.del(`content:${course_id}`);

      return res.status(201).json({
        message: 'Content added.',
        content_id: result.insertId
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
);

module.exports = router;