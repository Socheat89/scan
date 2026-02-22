const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');

const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.role, u.branch_id, b.name AS branch_name,
         u.schedule_id, s.name AS schedule_name,
         s.work_start_time, s.work_end_time,
         u.monthly_salary, u.created_at
  FROM users u
  LEFT JOIN branches b       ON b.id = u.branch_id
  LEFT JOIN work_schedules s ON s.id = u.schedule_id
`;

async function getAll(req, res) {
  try {
    const [rows] = await getPool().query(USER_SELECT + ' ORDER BY u.id DESC');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

async function getOne(req, res) {
  try {
    const [[row]] = await getPool().query(USER_SELECT + ' WHERE u.id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'User not found' });
    res.json(row);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

async function create(req, res) {
  const { name, email, password, role = 'employee', branch_id, schedule_id, monthly_salary } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email and password are required' });
  // Employees must have a schedule
  if (role !== 'admin' && !schedule_id)
    return res.status(400).json({ message: 'Work schedule is required for employees' });
  if (schedule_id) {
    const [[sched]] = await getPool().query('SELECT id FROM work_schedules WHERE id = ?', [schedule_id]);
    if (!sched) return res.status(400).json({ message: 'Selected work schedule not found' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await getPool().query(
      'INSERT INTO users (name, email, password, role, branch_id, schedule_id, monthly_salary) VALUES (?,?,?,?,?,?,?)',
      [name, email, hash, role, branch_id || null, schedule_id || null, monthly_salary || 0]
    );
    res.status(201).json({ id: result.insertId, name, email, role, branch_id, schedule_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already exists' });
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
}

async function update(req, res) {
  const { name, email, password, role, branch_id, schedule_id, monthly_salary } = req.body;
  // Employees must have a schedule
  if (role !== 'admin' && !schedule_id)
    return res.status(400).json({ message: 'Work schedule is required for employees' });
  if (schedule_id) {
    const [[sched]] = await getPool().query('SELECT id FROM work_schedules WHERE id = ?', [schedule_id]);
    if (!sched) return res.status(400).json({ message: 'Selected work schedule not found' });
  }
  try {
    let pwClause = '', params = [name, email, role, branch_id || null, schedule_id || null, monthly_salary || 0];
    if (password) { pwClause = ', password=?'; params.push(await bcrypt.hash(password, 10)); }
    params.push(req.params.id);
    await getPool().query(
      'UPDATE users SET name=?,email=?,role=?,branch_id=?,schedule_id=?,monthly_salary=?' + pwClause + ' WHERE id=?',
      params
    );
    res.json({ message: 'User updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already exists' });
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
}

async function remove(req, res) {
  if (req.user.id === parseInt(req.params.id))
    return res.status(400).json({ message: 'Cannot delete yourself' });
  try {
    await getPool().query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
}

module.exports = { getAll, getOne, create, update, remove };
