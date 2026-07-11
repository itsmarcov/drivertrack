const { run } = require('./database');

async function logActivity(user, action, entityType = null, entityId = null, details = null) {
  try {
    await run(
      `INSERT INTO activity_logs (user_id, user_name, user_role, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, user.full_name, user.role, action, entityType, entityId, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}

module.exports = { logActivity };
