const { COOKIE, json, clearCookie } = require('./_helpers');
module.exports = async (req, res) => { res.setHeader('Set-Cookie', clearCookie(COOKIE)); json(res, 200, { ok:true }); };
