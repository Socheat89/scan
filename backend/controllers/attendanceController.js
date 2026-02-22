const moment = require('moment');
const { getPool } = require('../config/db');
const { verifyQRToken } = require('../utils/qrToken');
const { calculateMetrics } = require('../utils/attendanceCalc');
const { checkIPWhitelist, checkGPS, checkFace } = require('../middleware/security');

const SCAN_FIELDS = ['check_in','break_out','break_in','check_out'];

async function scan(req, res) {
  const { qr_payload, location, face_descriptor } = req.body;
  if (!qr_payload) return res.status(400).json({ message: 'QR payload required' });
  let parsed;
  try { parsed = typeof qr_payload==='string' ? JSON.parse(qr_payload) : qr_payload; }
  catch { return res.status(400).json({ message: 'Invalid QR payload' }); }
  const { branch_id, token } = parsed;
  const userId = req.user.id;
  const today  = moment().format('YYYY-MM-DD');
  const timeNow= moment().format('HH:mm:ss');
  try {
    const pool = getPool();

    // ── Step 1: Verify branch + QR token ────────────────────────────────────
    const [[branch]] = await pool.query("SELECT id,qr_secret FROM branches WHERE id=?",[branch_id]);
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    if (!verifyQRToken(token, branch_id, branch.qr_secret))
      return res.status(403).json({ message: 'Invalid or expired QR code' });

    // ── Step 2: IP Whitelist ─────────────────────────────────────────────────
    await checkIPWhitelist(req, branch_id);

    // ── Step 3: Anti-fake GPS ────────────────────────────────────────────────
    await checkGPS(userId, location);

    // ── Step 4: Face Verification ────────────────────────────────────────────
    await checkFace(userId, face_descriptor);

    // ── Step 5: Employee branch + schedule validation ────────────────────────
    const [[employee]] = await pool.query(
      `SELECT u.id, u.branch_id, u.schedule_id,
              s.work_start_time, s.lunch_start_time, s.lunch_end_time, s.work_end_time
       FROM users u
       LEFT JOIN work_schedules s ON s.id = u.schedule_id
       WHERE u.id = ?`,
      [userId]
    );
    if (!employee || employee.branch_id !== branch_id)
      return res.status(403).json({ message: 'You are not assigned to this branch' });
    if (!employee.schedule_id)
      return res.status(400).json({ message: 'No work schedule assigned to your account. Contact admin.' });

    // ── Step 6: Determine next scan field ────────────────────────────────────
    const [[existing]] = await pool.query("SELECT * FROM attendance WHERE user_id=? AND date=?",[userId,today]);
    let nextField = null;
    if (!existing) { nextField='check_in'; }
    else { for (const f of SCAN_FIELDS) { if (!existing[f]) { nextField=f; break; } } }
    if (!nextField) return res.status(400).json({ message: 'All 4 scans for today are already recorded' });

    // ── Step 7: Build schedule-based config ──────────────────────────────────
    const [settingsRows] = await pool.query("SELECT config_key,config_value FROM settings");
    const globalSettings = Object.fromEntries(settingsRows.map(r=>[r.config_key,r.config_value]));
    const config = {
      work_start_time:  employee.work_start_time,
      work_end_time:    employee.work_end_time,
      lunch_start_time: employee.lunch_start_time,
      lunch_end_time:   employee.lunch_end_time,
      grace_period:     globalSettings.grace_period  || 15,
      break_duration:   globalSettings.break_duration || 60,
    };

    // ── Step 8: Save attendance ───────────────────────────────────────────────
    if (!existing) {
      await pool.query("INSERT INTO attendance (user_id,branch_id,date,check_in,status) VALUES (?,?,?,?,'present')",[userId,branch_id,today,timeNow]);
      const scans = { check_in: timeNow };
      const metrics = calculateMetrics(scans, config);
      await pool.query("UPDATE attendance SET late_minutes=?,status=? WHERE user_id=? AND date=?",[metrics.late_minutes,metrics.status,userId,today]);
    } else {
      await pool.query("UPDATE attendance SET ?? = ? WHERE user_id=? AND date=?",[nextField,timeNow,userId,today]);
      if (nextField==='check_out') {
        const [[updated]] = await pool.query("SELECT * FROM attendance WHERE user_id=? AND date=?",[userId,today]);
        const metrics = calculateMetrics(updated, config);
        await pool.query("UPDATE attendance SET total_hours=?,late_minutes=?,overtime_minutes=?,status=? WHERE user_id=? AND date=?",[metrics.total_hours,metrics.late_minutes,metrics.overtime_minutes,metrics.status,userId,today]);
      }
    }
    res.json({ message: nextField.replace('_',' ') + ' recorded at ' + timeNow, scan: nextField });
  } catch (err) {
    // Security middleware throws plain objects {status, message}
    if (err.status && err.message) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

async function myAttendance(req, res) {
  const userId = req.user.id;
  const { month, year } = req.query;
  try {
    let query="SELECT * FROM attendance WHERE user_id=?", params=[userId];
    if (year && month) { query+=" AND YEAR(date)=? AND MONTH(date)=?"; params.push(year,month); }
    query+=" ORDER BY date DESC";
    const [rows] = await getPool().query(query, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

async function report(req, res) {
  const { branch_id, date_from, date_to, user_id } = req.query;
  try {
    let q="SELECT a.*,u.name AS user_name,u.email,b.name AS branch_name FROM attendance a JOIN users u ON u.id=a.user_id JOIN branches b ON b.id=a.branch_id WHERE 1=1";
    const p=[];
    if (branch_id) { q+=" AND a.branch_id=?"; p.push(branch_id); }
    if (user_id)   { q+=" AND a.user_id=?";   p.push(user_id); }
    if (date_from) { q+=" AND a.date>=?";      p.push(date_from); }
    if (date_to)   { q+=" AND a.date<=?";      p.push(date_to); }
    q+=" ORDER BY a.date DESC,u.name ASC";
    const [rows] = await getPool().query(q, p);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

async function dashboard(req, res) {
  const today = moment().format('YYYY-MM-DD');
  try {
    const pool=getPool();
    const [[{total}]]   = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role='employee'");
    const [[{present}]] = await pool.query("SELECT COUNT(*) AS present FROM attendance WHERE date=? AND status!='absent'",[today]);
    const [[{late}]]    = await pool.query("SELECT COUNT(*) AS late FROM attendance WHERE date=? AND status='late'",[today]);
    res.json({ total, present, late, absent: total-present });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

async function getSettings(req, res) {
  try {
    const [rows] = await getPool().query("SELECT config_key,config_value FROM settings");
    res.json(Object.fromEntries(rows.map(r=>[r.config_key,r.config_value])));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

async function updateSettings(req, res) {
  const allowed=['work_start_time','work_end_time','break_duration','grace_period'];
  try {
    const pool=getPool();
    for (const key of allowed) {
      if (req.body[key]!==undefined) await pool.query("UPDATE settings SET config_value=? WHERE config_key=?",[req.body[key],key]);
    }
    res.json({ message: 'Settings updated' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

module.exports = { scan, myAttendance, report, dashboard, getSettings, updateSettings };
