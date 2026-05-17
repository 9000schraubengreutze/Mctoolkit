const { json, modrinth } = require('./_helpers');

async function getJson(req, route) {
  return (await modrinth(req, route)).json();
}
function dedupe(projects) {
  const seen = new Set();
  const out = [];
  for (const p of projects || []) {
    const key = p.id || p.slug;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

module.exports = async (req, res) => {
  try {
    const user = await getJson(req, '/user');
    const ids = [user.id, user.username].filter(Boolean);
    const owned = [];
    for (const id of ids) {
      try { owned.push(...await getJson(req, '/user/' + encodeURIComponent(id) + '/projects')); } catch (_) {}
    }

    let followed = [];
    for (const id of ids) {
      try { followed = await getJson(req, '/user/' + encodeURIComponent(id) + '/follows'); break; } catch (_) {}
    }

    const projects = dedupe([...owned, ...followed])
      .filter(p => p.project_type === 'modpack')
      .sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));

    json(res, 200, { user, projects, owned_count: owned.length, followed_count: followed.length });
  } catch(e) {
    json(res, e.status || 500, { error:e.message });
  }
};
