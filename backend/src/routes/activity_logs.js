const express = require('express');
const { queryAll } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  const { action, entity_type, user_id, limit = 100, offset = 0 } = req.query;
  const conditions = [];
  const params = [];

  if (action) { conditions.push(`al.action = $${params.length + 1}`); params.push(action); }
  if (entity_type) { conditions.push(`al.entity_type = $${params.length + 1}`); params.push(entity_type); }
  if (user_id) { conditions.push(`al.user_id = $${params.length + 1}`); params.push(Number(user_id)); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `
    SELECT al.*, u.full_name AS actor_name, u.role AS actor_role
    FROM activity_logs al
    JOIN users u ON u.id = al.user_id
    ${where}
    ORDER BY al.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  params.push(Number(limit), Number(offset));

  const logs = await queryAll(sql, params);

  const countResult = await queryAll(
    `SELECT COUNT(*) AS total FROM activity_logs al ${where}`,
    params.slice(0, -2)
  );

  const distinctActions = await queryAll('SELECT DISTINCT action FROM activity_logs ORDER BY action');
  const distinctEntityTypes = await queryAll('SELECT DISTINCT entity_type FROM activity_logs WHERE entity_type IS NOT NULL ORDER BY entity_type');

  res.json({
    logs,
    total: Number(countResult[0]?.total || 0),
    filters: {
      actions: distinctActions.map(r => r.action),
      entity_types: distinctEntityTypes.map(r => r.entity_type),
    },
  });
});

module.exports = router;
