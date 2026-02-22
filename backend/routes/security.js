const router  = require('express').Router();
const ctrl    = require('../controllers/securityController');
const auth    = require('../middleware/auth');
const reqRole = require('../middleware/roleCheck');

// Client-visible settings (employee can read which security features are active)
router.get('/client-settings', auth, async (req, res) => {
  try {
    const { getPool } = require('../config/db');
    const [rows] = await getPool().query(
      'SELECT `key`, `value` FROM system_security_settings WHERE `key` IN (?, ?)',
      ['face_verification_enabled', 'anti_gps_spoof_enabled']
    );
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      face_verification_enabled: s.face_verification_enabled === 'true',
      anti_gps_spoof_enabled:    s.anti_gps_spoof_enabled    === 'true',
    });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Security settings
router.get('/settings',    auth, reqRole('admin'), ctrl.getSettings);
router.put('/settings',    auth, reqRole('admin'), ctrl.updateSettings);

// Logs (read-only, admin)
router.get('/gps-logs',    auth, reqRole('admin'), ctrl.getGpsLogs);
router.get('/face-logs',   auth, reqRole('admin'), ctrl.getFaceLogs);

// Face management
router.post('/face/register',      auth, reqRole('admin'), ctrl.registerFace);
router.delete('/face/:id',         auth, reqRole('admin'), ctrl.removeFace);

// IP Whitelist
router.get('/ip-whitelist',        auth, reqRole('admin'), ctrl.getIPWhitelist);
router.post('/ip-whitelist',       auth, reqRole('admin'), ctrl.addIPWhitelist);
router.delete('/ip-whitelist/:id', auth, reqRole('admin'), ctrl.removeIPWhitelist);

module.exports = router;
