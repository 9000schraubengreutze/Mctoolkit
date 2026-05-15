const API = 'https://api.modrinth.com/v2';
const OAUTH_TOKEN = 'https://api.modrinth.com/_internal/oauth/token';
const OAUTH_AUTHORIZE = 'https://modrinth.com/auth/authorize';
const COOKIE = 'mct_modrinth_token';
const STATE_COOKIE = 'mct_modrinth_state';
const UA = '9000schraubengreutze/mctoolkit/1.0';
function redirectUri(req) { return process.env.MODRINTH_REDIRECT_URI || new URL('/api/modrinth/callback', 'https://' + req.headers.host).toString(); }
function cookieHeader(name, value, maxAge) { return name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge; }
function clearCookie(name) { return name + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'; }
function readCookie(req, name) { const raw = req.headers.cookie || ''; const hit = raw.split(';').map(v => v.trim()).find(v => v.startsWith(name + '=')); return hit ? decodeURIComponent(hit.slice(name.length + 1)) : ''; }
function json(res, status, body) { res.statusCode = status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(body)); }
function requireConfig() { if (!process.env.MODRINTH_CLIENT_ID || !process.env.MODRINTH_CLIENT_SECRET) throw new Error('Modrinth OAuth ist noch nicht konfiguriert. Setze MODRINTH_CLIENT_ID und MODRINTH_CLIENT_SECRET in Vercel.'); }
async function modrinth(req, route, options={}) { const token = readCookie(req, COOKIE); if (!token) { const e = new Error('Nicht mit Modrinth verbunden.'); e.status = 401; throw e; } const headers = Object.assign({ Authorization: token, 'User-Agent': UA }, options.headers || {}); const r = await fetch(API + route, Object.assign({}, options, { headers })); if (!r.ok) { let msg = r.status + ' ' + r.statusText; try { const data = await r.json(); msg = data.description || data.error || msg; } catch(_) {} const e = new Error(msg); e.status = r.status; throw e; } return r; }
async function readJson(req) { return new Promise((resolve,reject)=>{ let body=''; req.on('data', c => { body += c; if (body.length > 12 * 1024 * 1024) { reject(new Error('Upload zu gross.')); req.destroy(); } }); req.on('end',()=>{ try { resolve(body ? JSON.parse(body) : {}); } catch(e){ reject(e); } }); req.on('error', reject); }); }
module.exports = { API, OAUTH_TOKEN, OAUTH_AUTHORIZE, COOKIE, STATE_COOKIE, UA, redirectUri, cookieHeader, clearCookie, readCookie, json, requireConfig, modrinth, readJson };
