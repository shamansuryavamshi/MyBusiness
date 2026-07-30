module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    method: req.method,
    url: req.url || '(none)',
    contentType: req.headers['content-type'] || '(none)',
    bodyType: typeof req.body,
    bodyIsNull: req.body === null,
    bodyIsObj: req.body && typeof req.body === 'object' && !Array.isArray(req.body),
    bodyIsString: typeof req.body === 'string',
    bodyPreview: typeof req.body === 'string' ? req.body.substring(0, 200) :
                 (req.body && typeof req.body === 'object' ? '(object)' : '(none)'),
    queryKeys: Object.keys(req.query || {}).join(', '),
  });
};
