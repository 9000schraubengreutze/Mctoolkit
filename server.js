const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Content Security Policy & HTTP Security Headers
const CSP_HEADER_VALUE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.modrinth.com https://cdn.modrinth.com https://media.forgecdn.net https://*.curseforge.com https://*.googleusercontent.com https://avatars.githubusercontent.com https://mc-heads.net https://minotar.net https://crafatar.com",
  "connect-src 'self' https://api.modrinth.com https://api.curseforge.com https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.supabase.co wss://*.firebaseio.com wss://*.supabase.co blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP_HEADER_VALUE);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '15mb' }));

// Cloud SQL Query Helpers & Firebase Admin
let adminAuth = null;

try {
  const firebaseAdmin = require('firebase-admin');
  const firebaseConfig = require('./firebase-applet-config.json');
  if (!firebaseAdmin.apps.length) {
    firebaseAdmin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  adminAuth = firebaseAdmin.auth();
} catch (e) {
  console.warn('Firebase Admin init warning in server.js:', e);
}

// PostgreSQL Connection Pool
let pgPool = null;
if (process.env.SQL_HOST) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });
    pgPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
    console.log('Cloud SQL PG Pool initialized successfully.');
  } catch (err) {
    console.warn('Cloud SQL Pool init error:', err);
  }
}

// Helper Auth Middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    if (adminAuth) {
      const decoded = await adminAuth.verifyIdToken(token);
      req.user = decoded;
      return next();
    }
    // Fallback if adminAuth not loaded
    req.user = { uid: 'anonymous', email: '' };
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const optionalVerifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ') && adminAuth) {
    const token = authHeader.split('Bearer ')[1];
    try {
      req.user = await adminAuth.verifyIdToken(token);
    } catch (_) {}
  }
  next();
};

/* ══ CLOUD SQL API ENDPOINTS ══ */

// 1. User sync
app.post('/api/db/user/sync', verifyToken, async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Database not available' });
  const { uid, email, displayName, photoUrl, preferences } = req.body;
  const userUid = req.user?.uid || uid;
  const userEmail = req.user?.email || email || '';
  try {
    const query = `
      INSERT INTO users (uid, email, display_name, photo_url, preferences, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (uid) DO UPDATE
      SET email = $2, display_name = $3, photo_url = $4,
          preferences = COALESCE($5, users.preferences),
          updated_at = NOW()
      RETURNING *;
    `;
    const result = await pgPool.query(query, [
      userUid,
      userEmail,
      displayName || null,
      photoUrl || null,
      preferences ? JSON.stringify(preferences) : null
    ]);
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('User sync error:', err);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// 2. User Preferences (GET & POST)
app.get('/api/db/user/preferences', verifyToken, async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Database not available' });
  const userId = req.user.uid;
  try {
    const result = await pgPool.query(
      'SELECT preferences FROM users WHERE uid = $1 LIMIT 1',
      [userId]
    );
    res.json({ preferences: result.rows[0]?.preferences || {} });
  } catch (err) {
    console.error('Preferences fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

app.post('/api/db/user/preferences', verifyToken, async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Database not available' });
  const userId = req.user.uid;
  const { preferences } = req.body;
  try {
    const result = await pgPool.query(
      `UPDATE users SET preferences = $1, updated_at = NOW() WHERE uid = $2 RETURNING preferences;`,
      [JSON.stringify(preferences || {}), userId]
    );
    res.json({ success: true, preferences: result.rows[0]?.preferences || {} });
  } catch (err) {
    console.error('Preferences save error:', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// 3. User Profiles (GET)
app.get('/api/db/profiles', verifyToken, async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Database not available' });
  const userId = req.user.uid;
  try {
    const result = await pgPool.query(
      'SELECT id, user_id, name, data, updated_at FROM profiles WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Profiles fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// 4. User Profiles (SAVE/UPSERT)
app.post('/api/db/profiles', verifyToken, async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Database not available' });
  const userId = req.user.uid;
  const { name, data } = req.body;
  if (!name || !data) return res.status(400).json({ error: 'Name and data required' });

  try {
    const existing = await pgPool.query(
      'SELECT id FROM profiles WHERE user_id = $1 AND name = $2 LIMIT 1',
      [userId, name]
    );
    let row;
    if (existing.rows.length > 0) {
      const updateRes = await pgPool.query(
        'UPDATE profiles SET data = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [JSON.stringify(data), existing.rows[0].id]
      );
      row = updateRes.rows[0];
    } else {
      const insertRes = await pgPool.query(
        'INSERT INTO profiles (user_id, name, data, updated_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
        [userId, name, JSON.stringify(data)]
      );
      row = insertRes.rows[0];
    }
    res.json({ success: true, profile: row });
  } catch (err) {
    console.error('Profile save error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// 5. User Profiles (DELETE)
app.delete('/api/db/profiles/:name', verifyToken, async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Database not available' });
  const userId = req.user.uid;
  const name = req.params.name;
  try {
    await pgPool.query('DELETE FROM profiles WHERE user_id = $1 AND name = $2', [userId, name]);
    res.json({ success: true });
  } catch (err) {
    console.error('Profile delete error:', err);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// 6. Public Packs (GET ALL)
app.get('/api/db/public_packs', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Database not available' });
  try {
    const result = await pgPool.query(
      'SELECT * FROM public_packs ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Public packs fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch public packs' });
  }
});

// 7. Public Pack by Code (GET)
app.get('/api/db/public_packs/:code', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Database not available' });
  const code = req.params.code;
  try {
    const result = await pgPool.query(
      'SELECT * FROM public_packs WHERE pack_code = $1 LIMIT 1',
      [code]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Pack not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Public pack get error:', err);
    res.status(500).json({ error: 'Failed to fetch pack' });
  }
});

// 8. Public Pack Publish (POST)
app.post('/api/db/public_packs', verifyToken, async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Database not available' });
  const {
    pack_code,
    name,
    description,
    category,
    platform,
    mc_version,
    mods,
    resource_packs,
    username,
    user_email,
    mod_count
  } = req.body;

  const userId = req.user.uid;

  try {
    const query = `
      INSERT INTO public_packs (
        pack_code, name, description, category, platform, mc_version,
        mods, resource_packs, user_id, username, user_email, mod_count, likes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, NOW(), NOW())
      ON CONFLICT (pack_code) DO UPDATE
      SET name = $2, description = $3, category = $4, platform = $5, mc_version = $6,
          mods = $7, resource_packs = $8, updated_at = NOW()
      RETURNING *;
    `;
    const values = [
      pack_code,
      name,
      description || '',
      category || 'general',
      platform || 'modrinth',
      mc_version || '1.21.1',
      JSON.stringify(mods || []),
      JSON.stringify(resource_packs || []),
      userId,
      username || req.user.email?.split('@')[0] || 'User',
      user_email || req.user.email || '',
      mod_count || 0
    ];
    const result = await pgPool.query(query, values);
    res.json({ success: true, pack: result.rows[0] });
  } catch (err) {
    console.error('Public pack publish error:', err);
    res.status(500).json({ error: 'Failed to publish pack' });
  }
});

// 9. Public Pack Like (POST)
app.post('/api/db/public_packs/:code/like', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Database not available' });
  const code = req.params.code;
  try {
    const result = await pgPool.query(
      'UPDATE public_packs SET likes = COALESCE(likes, 0) + 1, updated_at = NOW() WHERE pack_code = $1 RETURNING *',
      [code]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Pack not found' });
    res.json({ success: true, likes: result.rows[0].likes });
  } catch (err) {
    console.error('Like pack error:', err);
    res.status(500).json({ error: 'Failed to increment like' });
  }
});

// Serve static files in root directory
app.use(express.static(__dirname));

// Vercel serverless functions route mappings
app.all('/api/modrinth/auth', require('./api/modrinth/auth.js'));
app.all('/api/modrinth/callback', require('./api/modrinth/callback.js'));
app.all('/api/modrinth/logout', require('./api/modrinth/logout.js'));
app.all('/api/modrinth/me', require('./api/modrinth/me.js'));
app.all('/api/modrinth/pack', require('./api/modrinth/pack.js'));
app.all('/api/modrinth/projects', require('./api/modrinth/projects.js'));
app.all('/api/modrinth/upload', require('./api/modrinth/upload.js'));

// SPA Fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
