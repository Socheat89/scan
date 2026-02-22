const { getPool } = require('../config/db');

// ── System Security Settings ───────────────────────────────────────────────

async function getSettings(req, res) {
  try {
    const [rows] = await getPool().query('SELECT `key`, `value` FROM system_security_settings');
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

async function updateSettings(req, res) {
  const allowed = [
    'anti_gps_spoof_enabled',
    'max_gps_accuracy',
    'face_verification_enabled',
    'face_similarity_threshold',
    'ip_restriction_enabled',
  ];
  try {
    const pool = getPool();
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await pool.query(
          'INSERT INTO system_security_settings (`key`, `value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=?',
          [key, String(req.body[key]), String(req.body[key])]
        );
      }
    }
    res.json({ message: 'Security settings updated' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

// ── GPS Security Logs ──────────────────────────────────────────────────────

async function getGpsLogs(req, res) {
  const { user_id, risk_level, limit = 100 } = req.query;
  try {
    let q = `SELECT g.*, u.name AS user_name FROM gps_security_logs g
             JOIN users u ON u.id = g.user_id WHERE 1=1`;
    const p = [];
    if (user_id)   { q += ' AND g.user_id = ?';    p.push(user_id); }
    if (risk_level){ q += ' AND g.risk_level = ?';  p.push(risk_level); }
    q += ' ORDER BY g.created_at DESC LIMIT ?';
    p.push(parseInt(limit));
    const [rows] = await getPool().query(q, p);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

// ── Face Verification Logs ─────────────────────────────────────────────────

async function getFaceLogs(req, res) {
  const { user_id, status, limit = 100 } = req.query;
  try {
    let q = `SELECT f.*, u.name AS user_name FROM face_verification_logs f
             JOIN users u ON u.id = f.user_id WHERE 1=1`;
    const p = [];
    if (user_id){ q += ' AND f.user_id = ?'; p.push(user_id); }
    if (status) { q += ' AND f.status = ?';  p.push(status); }
    q += ' ORDER BY f.created_at DESC LIMIT ?';
    p.push(parseInt(limit));
    const [rows] = await getPool().query(q, p);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

// ── Face Registration ──────────────────────────────────────────────────────

async function registerFace(req, res) {
  const { user_id, face_embedding } = req.body;
  if (!user_id || !face_embedding)
    return res.status(400).json({ message: 'user_id and face_embedding are required' });
  if (!Array.isArray(face_embedding) || face_embedding.length < 64)
    return res.status(400).json({ message: 'face_embedding must be a numeric array (128 values)' });
  try {
    await getPool().query(
      'UPDATE users SET face_registered = 1, face_embedding = ? WHERE id = ?',
      [JSON.stringify(face_embedding), user_id]
    );
    res.json({ message: 'Face template registered successfully' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

async function removeFace(req, res) {
  const { id } = req.params;
  try {
    await getPool().query(
      'UPDATE users SET face_registered = 0, face_embedding = NULL WHERE id = ?', [id]
    );
    res.json({ message: 'Face template removed' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

// ── Branch IP Whitelist ────────────────────────────────────────────────────

async function getIPWhitelist(req, res) {
  const { branch_id } = req.query;
  try {
    let q = 'SELECT w.*, b.name AS branch_name FROM branch_ip_whitelist w JOIN branches b ON b.id = w.branch_id';
    const p = [];
    if (branch_id) { q += ' WHERE w.branch_id = ?'; p.push(branch_id); }
    q += ' ORDER BY w.branch_id, w.id';
    const [rows] = await getPool().query(q, p);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

async function addIPWhitelist(req, res) {
  const { branch_id, ip_address_or_range } = req.body;
  if (!branch_id || !ip_address_or_range)
    return res.status(400).json({ message: 'branch_id and ip_address_or_range are required' });
  // Simple CIDR/IP sanity check
  const valid = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(ip_address_or_range.trim());
  if (!valid) return res.status(400).json({ message: 'Invalid IP or CIDR notation (e.g. 192.168.1.10 or 192.168.1.0/24)' });
  try {
    const [result] = await getPool().query(
      'INSERT INTO branch_ip_whitelist (branch_id, ip_address_or_range) VALUES (?,?)',
      [branch_id, ip_address_or_range.trim()]
    );
    res.status(201).json({ id: result.insertId, branch_id, ip_address_or_range });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

async function removeIPWhitelist(req, res) {
  try {
    await getPool().query('DELETE FROM branch_ip_whitelist WHERE id = ?', [req.params.id]);
    res.json({ message: 'IP entry removed' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

module.exports = {
  getSettings, updateSettings,
  getGpsLogs, getFaceLogs,
  registerFace, removeFace,
  getIPWhitelist, addIPWhitelist, removeIPWhitelist,
};
