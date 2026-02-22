/**
 * Security middleware: IP Whitelist, Anti-GPS Spoof, Face Verification.
 * All three are called from the attendance scan controller in order.
 * They are exported as async functions that throw rich error objects.
 */

const { getPool } = require('../config/db');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Load all system security settings as a plain object */
async function loadSecSettings() {
  const [rows] = await getPool().query('SELECT `key`, `value` FROM system_security_settings');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

/** Haversine distance in km between two lat/lon pairs */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Parse a CIDR string, e.g. "192.168.1.0/24" */
function ipInCIDR(ip, cidr) {
  try {
    if (!cidr.includes('/')) return ip === cidr;
    const [base, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr);
    const ipToInt = (s) => s.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipToInt(ip) & mask) === (ipToInt(base) & mask);
  } catch {
    return false;
  }
}

/** Euclidean distance between two descriptor arrays */
function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

// ── 1. IP Whitelist ────────────────────────────────────────────────────────

/**
 * checkIPWhitelist(req, branchId)
 * Throws { status, message } if blocked.
 * If ip_restriction_enabled=false OR no whitelist entries for this branch → allow.
 */
async function checkIPWhitelist(req, branchId) {
  const pool = getPool();
  const settings = await loadSecSettings();
  if (settings.ip_restriction_enabled !== 'true') return; // feature off

  const [entries] = await pool.query(
    'SELECT ip_address_or_range FROM branch_ip_whitelist WHERE branch_id = ?',
    [branchId]
  );
  if (entries.length === 0) return; // no whitelist = unrestricted

  const clientIP =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '';

  // Normalise IPv4-mapped IPv6 (::ffff:1.2.3.4) → 1.2.3.4
  const normalised = clientIP.replace(/^::ffff:/, '');

  const allowed = entries.some(row => ipInCIDR(normalised, row.ip_address_or_range));
  if (!allowed) {
    throw { status: 403, message: `Access denied: your IP (${normalised}) is not whitelisted for this branch.` };
  }
}

// ── 2. GPS Validation ──────────────────────────────────────────────────────

/**
 * checkGPS(userId, location)
 * location = { latitude, longitude, accuracy, altitude, speed, heading, timestamp, isMocked }
 * Logs to gps_security_logs.
 * Throws { status, message } on HIGH/MEDIUM risk rejection.
 */
async function checkGPS(userId, location) {
  const pool = getPool();
  const settings = await loadSecSettings();
  if (settings.anti_gps_spoof_enabled !== 'true') return; // feature off

  const {
    latitude, longitude, accuracy,
    altitude = null, speed = null, heading = null,
    timestamp, isMocked = false
  } = location || {};

  if (latitude == null || longitude == null) {
    throw { status: 400, message: 'Location data is required. Please enable GPS.' };
  }

  const maxAccuracy = parseFloat(settings.max_gps_accuracy || '50');
  let riskLevel = 'low';
  let reason = null;

  // ── Rule 1: mock location flag ──
  if (isMocked === true || isMocked === 'true') {
    riskLevel = 'high';
    reason = 'Mock location detected (isMocked=true)';
  }

  // ── Rule 2: accuracy too poor ──
  if (!reason && accuracy != null && accuracy > maxAccuracy) {
    riskLevel = 'medium';
    reason = `GPS accuracy ${accuracy}m exceeds allowed ${maxAccuracy}m`;
  }

  // ── Rule 3: stale timestamp (>5 min difference) ──
  if (!reason && timestamp) {
    const diffMs = Math.abs(Date.now() - new Date(timestamp).getTime());
    if (diffMs > 5 * 60 * 1000) {
      riskLevel = 'high';
      reason = `GPS timestamp is ${Math.round(diffMs / 60000)} min stale`;
    }
  }

  // ── Rule 4: location jump / speed anomaly ──
  if (!reason) {
    const [[lastLog]] = await pool.query(
      `SELECT latitude, longitude, created_at FROM gps_security_logs
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (lastLog) {
      const distKm = haversineKm(lastLog.latitude, lastLog.longitude, latitude, longitude);
      const dtH = (Date.now() - new Date(lastLog.created_at).getTime()) / 3_600_000;
      if (dtH > 0) {
        const impliedSpeedKmh = distKm / dtH;
        if (impliedSpeedKmh > 900) { // faster than commercial aircraft = impossible
          riskLevel = 'high';
          reason = `Impossible location jump: ${Math.round(distKm)}km in ${Math.round(dtH * 60)}min`;
        } else if (impliedSpeedKmh > 300) {
          riskLevel = 'medium';
          reason = `Suspicious speed: ${Math.round(impliedSpeedKmh)}km/h between scans`;
        }
      }
    }
  }

  // ── Rule 5: repeated identical coordinates (freeze spoofing) ──
  if (!reason) {
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM gps_security_logs
       WHERE user_id = ? AND latitude = ? AND longitude = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [userId, latitude, longitude]
    );
    if (cnt >= 7) {
      riskLevel = 'medium';
      reason = `Identical GPS coordinates repeated ${cnt} times in 7 days`;
    }
  }

  // Always log
  await pool.query(
    `INSERT INTO gps_security_logs
     (user_id, latitude, longitude, accuracy, speed, altitude, heading, is_mocked, risk_level, reason)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [userId, latitude, longitude, accuracy ?? null, speed ?? null,
     altitude ?? null, heading ?? null, isMocked ? 1 : 0, riskLevel, reason]
  );

  if (riskLevel === 'high') {
    throw { status: 403, message: `GPS security check failed: ${reason}` };
  }
  if (riskLevel === 'medium') {
    throw { status: 403, message: `GPS validation failed: ${reason}` };
  }
}

// ── 3. Face Verification ───────────────────────────────────────────────────

/**
 * checkFace(userId, faceDescriptor)
 * faceDescriptor = number[] (128D array from face-api.js on frontend)
 * Logs to face_verification_logs.
 * Throws { status, message } on fail.
 */
async function checkFace(userId, faceDescriptor) {
  const pool = getPool();
  const settings = await loadSecSettings();
  if (settings.face_verification_enabled !== 'true') return; // feature off

  // Load user's stored embedding
  const [[user]] = await pool.query(
    'SELECT face_registered, face_embedding FROM users WHERE id = ?', [userId]
  );

  if (!user?.face_registered || !user?.face_embedding) {
    await pool.query(
      'INSERT INTO face_verification_logs (user_id, similarity_score, status) VALUES (?,?,?)',
      [userId, null, 'no_template']
    );
    throw { status: 403, message: 'No face template registered. Contact your admin.' };
  }

  let storedDescriptor;
  try {
    storedDescriptor = JSON.parse(user.face_embedding);
  } catch {
    throw { status: 500, message: 'Stored face template is corrupted. Contact admin.' };
  }

  if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
    throw { status: 400, message: 'Face descriptor missing. Ensure camera is allowed.' };
  }

  const threshold = parseFloat(settings.face_similarity_threshold || '0.6');
  const distance  = euclideanDistance(faceDescriptor, storedDescriptor);
  // face-api.js: distance < threshold means SAME person (0.6 is industry standard)
  const passed = distance < threshold;
  const similarityScore = parseFloat((1 - Math.min(distance, 1)).toFixed(4));

  await pool.query(
    'INSERT INTO face_verification_logs (user_id, similarity_score, status) VALUES (?,?,?)',
    [userId, similarityScore, passed ? 'pass' : 'fail']
  );

  if (!passed) {
    throw {
      status: 403,
      message: `Face verification failed (distance: ${distance.toFixed(3)}, threshold: ${threshold}). Please try again.`
    };
  }
}

module.exports = { checkIPWhitelist, checkGPS, checkFace, loadSecSettings };
