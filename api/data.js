module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    method: req.method,
    url: req.url,
    ctype: req.headers['content-type'] || '',
    body: typeof req.body === 'string' ? req.body :
          (req.body && typeof req.body === 'object') ? '(object)' : String(req.body),
    hasBody: 'body' in req,
  });
};
