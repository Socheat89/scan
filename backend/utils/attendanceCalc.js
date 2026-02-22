const moment = require('moment');

function toMoment(t) {
  if (!t) return null;
  return moment(t, ['HH:mm:ss', 'HH:mm']);
}

/**
 * Calculate attendance metrics.
 * config must include schedule times from work_schedules:
 *   work_start_time, work_end_time, lunch_start_time?, lunch_end_time?
 * plus global settings: grace_period, break_duration (fallback)
 */
function calculateMetrics(scans, config) {
  // Schedule times — required from user's assigned work_schedule
  const workStart = toMoment(config.work_start_time);
  const workEnd   = toMoment(config.work_end_time);
  if (!workStart || !workEnd) throw new Error('work_start_time and work_end_time are required in config');

  const grace = parseInt(config.grace_period || 15);

  // Break duration: prefer actual lunch window, fall back to global break_duration
  let scheduledBreak = parseInt(config.break_duration || 60);
  if (config.lunch_start_time && config.lunch_end_time) {
    const ls = toMoment(config.lunch_start_time);
    const le = toMoment(config.lunch_end_time);
    if (ls && le) scheduledBreak = le.diff(ls, 'minutes');
  }

  const checkIn  = toMoment(scans.check_in);
  const checkOut = toMoment(scans.check_out);

  let total_hours = 0, late_minutes = 0, overtime_minutes = 0, status = 'absent';

  if (checkIn) {
    status = 'present';
    const threshold = workStart.clone().add(grace, 'minutes');
    if (checkIn.isAfter(threshold)) {
      late_minutes = checkIn.diff(workStart, 'minutes');
      status = 'late';
    }
    if (checkOut) {
      const gross = checkOut.diff(checkIn, 'minutes');
      // Use actual break scans if available, otherwise use scheduled break
      const breakTaken = (scans.break_out && scans.break_in)
        ? toMoment(scans.break_in).diff(toMoment(scans.break_out), 'minutes')
        : scheduledBreak;
      total_hours = parseFloat((Math.max(0, gross - breakTaken) / 60).toFixed(2));
      if (checkOut.isAfter(workEnd)) overtime_minutes = checkOut.diff(workEnd, 'minutes');
    }
  }

  return { total_hours, late_minutes, overtime_minutes, status };
}

module.exports = { calculateMetrics };
