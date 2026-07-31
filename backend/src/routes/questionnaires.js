const express = require('express');
const { queryAll, queryOne, run } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { generatePdf, questionnaireReportHtml } = require('../pdf');
const { logActivity } = require('../logActivity');

const router = express.Router();

router.post('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { title, description, questions, audience_type, station_ids, driver_ids } = req.body;
  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'title and at least one question are required' });
  }
  for (const q of questions) {
    if (!q.question_text || !q.question_text.trim()) {
      return res.status(400).json({ error: 'Every question needs text' });
    }
    if (q.question_type === 'choice' && (!q.options || !Array.isArray(q.options) || q.options.length < 2)) {
      return res.status(400).json({ error: 'Choice questions need at least two options' });
    }
  }
  const audience = audience_type || 'all';
  if (audience === 'drivers' && (!driver_ids || driver_ids.length === 0)) {
    return res.status(400).json({ error: 'Select at least one driver' });
  }
  if (audience === 'stations' && (!station_ids || station_ids.length === 0)) {
    return res.status(400).json({ error: 'Select at least one station' });
  }

  const result = await run(
    `INSERT INTO questionnaires (title, description, status, audience_type, station_ids, driver_ids, created_by)
     VALUES ($1, $2, 'active', $3, $4, $5, $6)`,
    [title, description || null, audience,
      audience === 'stations' ? station_ids.join(',') : null,
      audience === 'drivers' ? driver_ids.join(',') : null,
      req.user.id]
  );
  const qid = result.lastInsertRowid;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await run(
      `INSERT INTO questionnaire_questions (questionnaire_id, question_text, question_type, options, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [qid, q.question_text.trim(), q.question_type || 'text', q.question_type === 'choice' ? JSON.stringify(q.options) : null, i]
    );
  }

  logActivity(req.user, 'create_questionnaire', 'questionnaire', qid, { title });
  res.status(201).json({ id: qid });
});

router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const list = await queryAll(
    `SELECT q.id, q.title, q.description, q.status, q.created_at, q.audience_type, q.station_ids, q.driver_ids,
            u.full_name as created_by_name,
            (SELECT COUNT(*)::int FROM questionnaire_questions qq WHERE qq.questionnaire_id = q.id) as questions_count,
            (SELECT COUNT(*)::int FROM questionnaire_responses qr WHERE qr.questionnaire_id = q.id) as responses_count
     FROM questionnaires q
     LEFT JOIN users u ON q.created_by = u.id
     ORDER BY q.created_at DESC`
  );
  res.json(list);
});

router.get('/active', authenticate, authorize('driver'), async (req, res) => {
  const user = await queryOne('SELECT id, station_id FROM users WHERE id = $1', [req.user.id]);
  if (!user) return res.json([]);
  const rows = await queryAll(
    `SELECT q.id, q.title, q.description, q.created_at, q.audience_type, q.station_ids, q.driver_ids,
            COALESCE(json_agg(
              json_build_object('id', qq.id, 'question_text', qq.question_text, 'question_type', qq.question_type, 'options', qq.options)
              ORDER BY qq.sort_order
            ) FILTER (WHERE qq.id IS NOT NULL), '[]') as questions
     FROM questionnaires q
     JOIN questionnaire_questions qq ON qq.questionnaire_id = q.id
     LEFT JOIN questionnaire_responses qr ON qr.questionnaire_id = q.id AND qr.driver_id = $1
     WHERE q.status = 'active' AND qr.id IS NULL
     GROUP BY q.id, q.title, q.description, q.created_at, q.audience_type, q.station_ids, q.driver_ids
     ORDER BY q.created_at ASC`,
    [req.user.id]
  );
  const filtered = rows.filter((r) => {
    if (r.audience_type === 'all') return true;
    if (r.audience_type === 'drivers') {
      if (!r.driver_ids) return false;
      const ids = r.driver_ids.split(',').map((s) => parseInt(s.trim()));
      return ids.includes(user.id);
    }
    if (r.audience_type === 'stations') {
      if (!r.station_ids || !user.station_id) return false;
      const ids = r.station_ids.split(',').map((s) => parseInt(s.trim()));
      return ids.includes(user.station_id);
    }
    return false;
  });
  const parsed = filtered.map((r) => {
    const questions = typeof r.questions === 'string' ? JSON.parse(r.questions) : r.questions;
    const cleaned = questions.map((qq) => {
      if (qq.question_type === 'choice' && qq.options) {
        try { qq.options = JSON.parse(qq.options); } catch { qq.options = []; }
      }
      return qq;
    });
    return { ...r, questions: cleaned };
  });
  res.json(parsed);
});

router.get('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const q = await queryOne('SELECT * FROM questionnaires WHERE id = $1', [id]);
  if (!q) return res.status(404).json({ error: 'Questionnaire not found' });

  const questions = await queryAll(
    `SELECT id, question_text, question_type, options, sort_order FROM questionnaire_questions
     WHERE questionnaire_id = $1 ORDER BY sort_order ASC`,
    [id]
  );
  const questionMap = new Map(questions.map((qq) => {
    let opts = qq.options;
    if (qq.question_type === 'choice' && opts) {
      try { opts = JSON.parse(opts); } catch { opts = []; }
    }
    return [qq.id, { ...qq, options: opts }];
  }));

  const responses = await queryAll(
    `SELECT qr.id, qr.answers, qr.submitted_at, u.full_name as driver_name, u.phone as driver_phone,
            u.license_plate, s.name as station_name
     FROM questionnaire_responses qr
     JOIN users u ON qr.driver_id = u.id
     LEFT JOIN stations s ON u.station_id = s.id
     WHERE qr.questionnaire_id = $1 ORDER BY qr.submitted_at ASC`,
    [id]
  );
  const parsedResponses = responses.map((r) => {
    let answers = {};
    try { answers = JSON.parse(r.answers); } catch {}
    return { ...r, answers };
  });

  res.json({ ...q, questions: [...questionMap.values()], responses: parsedResponses });
});

router.post('/:id/respond', authenticate, authorize('driver'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { answers } = req.body;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'answers object is required' });
  }

  const q = await queryOne('SELECT id, status FROM questionnaires WHERE id = $1', [id]);
  if (!q) return res.status(404).json({ error: 'Questionnaire not found' });
  if (q.status !== 'active') return res.status(400).json({ error: 'Questionnaire is closed' });

  const existing = await queryOne('SELECT id FROM questionnaire_responses WHERE questionnaire_id = $1 AND driver_id = $2', [id, req.user.id]);
  if (existing) return res.status(400).json({ error: 'You already answered this questionnaire' });

  await run(
    `INSERT INTO questionnaire_responses (questionnaire_id, driver_id, answers) VALUES ($1, $2, $3)`,
    [id, req.user.id, JSON.stringify(answers)]
  );
  res.json({ success: true });
});

router.get('/:id/report', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const q = await queryOne('SELECT * FROM questionnaires WHERE id = $1', [id]);
    if (!q) return res.status(404).json({ error: 'Questionnaire not found' });

    const questions = await queryAll(
      `SELECT id, question_text, question_type, options FROM questionnaire_questions
       WHERE questionnaire_id = $1 ORDER BY sort_order ASC`,
      [id]
    );
    const questionsWithOptions = questions.map((qq) => {
      let opts = qq.options;
      if (qq.question_type === 'choice' && opts) {
        try { opts = JSON.parse(opts); } catch { opts = []; }
      }
      return { ...qq, options: opts };
    });

    const responses = await queryAll(
      `SELECT qr.answers, qr.submitted_at, u.full_name as driver_name, u.phone as driver_phone,
              u.license_plate, s.name as station_name
       FROM questionnaire_responses qr
       JOIN users u ON qr.driver_id = u.id
       LEFT JOIN stations s ON u.station_id = s.id
       WHERE qr.questionnaire_id = $1 ORDER BY qr.submitted_at ASC`,
      [id]
    );
    const parsedResponses = responses.map((r) => {
      let answers = {};
      try { answers = JSON.parse(r.answers); } catch {}
      return { ...r, answers };
    });

    const buf = await generatePdf(questionnaireReportHtml(q, questionsWithOptions, parsedResponses));
    console.log('Questionnaire report PDF: %d bytes', buf.length);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="questionnaire-${q.id}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    console.error('Questionnaire report error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate report: ' + err.message });
  }
});

router.delete('/:id', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const q = await queryOne('SELECT id, title FROM questionnaires WHERE id = $1', [id]);
  if (!q) return res.status(404).json({ error: 'Questionnaire not found' });
  await run('DELETE FROM questionnaire_responses WHERE questionnaire_id = $1', [id]);
  await run('DELETE FROM questionnaire_questions WHERE questionnaire_id = $1', [id]);
  await run('DELETE FROM questionnaires WHERE id = $1', [id]);
  logActivity(req.user, 'delete_questionnaire', 'questionnaire', id, { title: q.title });
  res.json({ success: true });
});

router.patch('/:id/status', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  if (!['active', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const q = await queryOne('SELECT id, title FROM questionnaires WHERE id = $1', [id]);
  if (!q) return res.status(404).json({ error: 'Questionnaire not found' });
  await run('UPDATE questionnaires SET status = $1 WHERE id = $2', [status, id]);
  logActivity(req.user, 'update_questionnaire', 'questionnaire', id, { status });
  res.json({ success: true });
});

module.exports = router;
