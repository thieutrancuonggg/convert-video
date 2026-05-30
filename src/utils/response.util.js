function sendSuccess(res, data, message = 'OK') {
  return res.json({ success: true, message, data });
}

function sendError(res, message, statusCode = 500) {
  return res.status(statusCode).json({ success: false, message });
}

module.exports = { sendSuccess, sendError };
