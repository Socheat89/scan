const { getPool } = require('../config/db');

async function getAll(req, res) {
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM work_schedules ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getOne(req, res) {
  try {
    const [[row]] = await getPool().query(
      'SELECT * FROM work_schedules WHERE id = ?', [req.params.id]
    );
    if (!row) return res.status(404).json({ message: 'Schedule not found' });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

async function create(req, res) {
  const { name, work_start_time, lunch_start_time, lunch_end_time, work_end_time } = req.body;
  if (!name || !work_start_time || !work_end_time)
    return res.status(400).json({ message: 'name, work_start_time and work_end_time are required' });
  try {
    const [result] = await getPool().query(
      `INSERT INTO work_schedules (name, work_start_time, lunch_start_time, lunch_end_time, work_end_time)
       VALUES (?, ?, ?, ?, ?)`,
      [name, work_start_time, lunch_start_time || null, lunch_end_time || null, work_end_time]
    );
    res.status(201).json({ id: result.insertId, name, work_start_time, lunch_start_time, lunch_end_time, work_end_time });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

async function update(req, res) {
  const { name, work_start_time, lunch_start_time, lunch_end_time, work_end_time } = req.body;
  if (!name || !work_start_time || !work_end_time)
    return res.status(400).json({ message: 'name, work_start_time and work_end_time are required' });
  try {
    const [r] = await getPool().query(
      `UPDATE work_schedules SET name=?, work_start_time=?, lunch_start_time=?, lunch_end_time=?, work_end_time=?
       WHERE id=?`,
      [name, work_start_time, lunch_start_time || null, lunch_end_time || null, work_end_time, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ message: 'Schedule not found' });
    res.json({ message: 'Schedule updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

async function remove(req, res) {
  try {
    // Prevent deletion if any user is still assigned
    const [[{ cnt }]] = await getPool().query(
      'SELECT COUNT(*) AS cnt FROM users WHERE schedule_id = ?', [req.params.id]
    );
    if (cnt > 0)
      return res.status(400).json({ message: `Cannot delete: ${cnt} employee(s) are using this schedule` });
    const [r] = await getPool().query('DELETE FROM work_schedules WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ message: 'Schedule not found' });
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getAll, getOne, create, update, remove };
