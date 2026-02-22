const CryptoJS = require('crypto-js');
const moment   = require('moment');

function generateDailyToken(branchId, qrSecret, date) {
  const dateStr = date || moment().format('YYYY-MM-DD');
  const message = `${branchId}|${dateStr}`;
  return CryptoJS.HmacSHA256(message, qrSecret).toString();
}

function verifyQRToken(token, branchId, qrSecret) {
  const expected = generateDailyToken(branchId, qrSecret);
  return token === expected;
}

module.exports = { generateDailyToken, verifyQRToken };
