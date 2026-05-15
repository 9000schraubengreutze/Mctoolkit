const { json, modrinth } = require('./_helpers');
module.exports = async (req, res) => { try { const r = await modrinth(req, '/user'); json(res, 200, await r.json()); } catch(e) { json(res, e.status || 500, { error:e.message }); } };
