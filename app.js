const API = "https://api.modrinth.com/v2";

/* ── FAQ ── */
function toggleFaq(el) {
  const a = el.nextElementSibling;
  const open = a.classList.toggle("open");
  el.classList.toggle("open", open);
}

/* ── Page Nav ── */
function showPage(p) {
  document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".page-tab").forEach(x => x.classList.remove("active","merge","fix"));
  document.getElementById("page-"+p).classList.add("active");
  const tab = document.getElementById("tab-"+p);
  tab.classList.add("active");
  if (p==="merge")   tab.classList.add("merge");
  if (p==="fix")     tab.classList.add("fix");
  if (p==="upgrade") tab.classList.add("upgrade");
  if (p==="convert") tab.classList.add("convert");
  if (p === 'community') {
    if (_communityLoaded) {
      _allCommunityPacks = dedupeCommunityPacks(_allCommunityPacks);
      renderCommunityPacks();
    } else {
      loadPublicPacks();
    }
  }
}

/* ══ PUBLIC PACKS ═══════════════════════════════════════════════ */
let _allCommunityPacks = [];
let _communityFilter   = 'all';
let _communityLoaded   = false;

function dedupeCommunityPacks(packs) {
  const seen = new Set();
  const out = [];
  for (const p of packs) {
    const keys = [];
    if (p.pack_code) keys.push('c:' + String(p.pack_code).toUpperCase());
    const nameKey = (p.name || '').trim().toLowerCase();
    const ownerKey = (p.user_id || p.username || '').toString().toLowerCase();
    keys.push('k:' + nameKey + '|' + ownerKey);
    if (keys.some(k => seen.has(k))) continue;
    keys.forEach(k => seen.add(k));
    out.push(p);
  }
  return out;
}

function applyPublicPackData(data) {
  if (!data) return false;
  const mods = (data.mods || []).map(m => ({
    slug: m.slug || m.project_id || '',
    name: m.name || m.title || m.slug || 'Unbekannt',
    cat: m.cat || 'Community'
  })).filter(m => m.slug);
  const rps = (data.resource_packs || []).map(r => ({
    slug: r.slug || r.project_id || '',
    name: r.name || r.title || r.slug || 'Unbekannt'
  })).filter(r => r.slug);
  if (!mods.length && !rps.length) return false;
  MODS = mods;
  RESOURCEPACKS = rps;
  if (data.name) document.getElementById('packName').value = data.name;
  if (data.mc_version) {
    const sel = document.getElementById('mcVersion');
    for (const opt of sel.options) {
      if (opt.value === data.mc_version) { sel.value = opt.value; break; }
    }
  }
  if (data.platform === 'modrinth' || data.platform === 'curseforge') {
    selectedPlatform = data.platform;
    try { localStorage.setItem('mctoolkit_platform', data.platform); } catch (_) {}
    const ind = document.getElementById('platformIndicator');
    if (ind) {
      ind.style.display = 'flex';
      document.getElementById('piDot').className = 'pi-dot ' + data.platform;
      document.getElementById('piName').className = 'pi-name ' + data.platform;
      document.getElementById('piName').textContent = data.platform === 'modrinth' ? 'Modrinth' : 'CurseForge';
      document.getElementById('piFormat').textContent = data.platform === 'modrinth' ? '.mrpack' : '.zip';
      const btn = document.getElementById('buildBtn');
      if (btn) btn.textContent = data.platform === 'modrinth'
        ? '⬇ .mrpack generieren & downloaden'
        : '⬇ CurseForge .zip generieren & downloaden';
    }
  }
  renderMods();
  renderRPs();
  if (typeof updateBuildBtn === 'function') updateBuildBtn();
  return true;
}

async function loadPublicPacks(force = false) {
  if (_communityLoaded && !force) return;
  const grid    = document.getElementById('communityGrid');
  const loading = document.getElementById('commLoading');
  if (loading) loading.style.display = 'flex';

  try {
    const { data, error } = await sb
      .from('public_packs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    _allCommunityPacks = dedupeCommunityPacks(data || []);
    _communityLoaded = true;
    renderCommunityPacks();
  } catch (err) {
    if (grid) grid.innerHTML = `
      <div class="comm-empty">
        ⚠ Fehler beim Laden.<br>
        <span style="font-size:.75rem;color:var(--muted)">${esc(err.message || 'Verbindungsfehler')}</span>
        <br><button onclick="loadPublicPacks(true)" style="margin-top:.6rem;padding:5px 14px;border-radius:7px;border:1px solid var(--border);background:none;color:var(--sub);font-family:var(--font);font-size:.75rem;cursor:pointer">Nochmal versuchen</button>
      </div>`;
  }
}

function renderCommunityPacks() {
  const grid   = document.getElementById('communityGrid');
  const search = (document.getElementById('communitySearch')?.value || '').toLowerCase();
  if (!grid) return;

  let packs = _allCommunityPacks.filter(p => {
    const matchFilter = _communityFilter === 'all'
      || p.category === _communityFilter
      || p.platform === _communityFilter;
    const matchSearch = !search
      || p.name?.toLowerCase().includes(search)
      || p.description?.toLowerCase().includes(search)
      || p.username?.toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });

  if (!packs.length) {
    grid.innerHTML = `<div class="comm-empty">😕 Keine Packs gefunden.<br><span style="font-size:.75rem;color:var(--muted)">Sei der Erste und teile deinen Pack!</span></div>`;
    return;
  }

  const catColors = { pvp:'#f87171', performance:'#60a5fa', survival:'var(--green)', tech:'#a78bfa', modded:'#fbbf24', general:'var(--muted)' };
  const catLabels = { pvp:'⚔ PvP', performance:'⚡ Performance', survival:'🌲 Survival', tech:'⚙ Tech', modded:'🔮 Modded', general:'📦 Allgemein' };

  grid.innerHTML = packs.map(p => {
    const color = catColors[p.category] || catColors.general;
    const label = catLabels[p.category] || '📦 Allgemein';
    const date  = new Date(p.created_at).toLocaleDateString('de-DE', { day:'2-digit', month:'short' });
    const mods  = p.mods || [];
    const plat  = p.platform === 'modrinth' ? '🟢 Modrinth' : p.platform === 'curseforge' ? '🟠 CurseForge' : '📦';

    return `
    <div class="comm-card">
      <div class="comm-card-top">
        <span class="comm-cat-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${label}</span>
        <span class="comm-plat">${plat}</span>
      </div>
      <div class="comm-card-name">${esc(p.name)}</div>
      ${p.description ? `<div class="comm-card-desc">${esc(p.description)}</div>` : ''}
      <div class="comm-card-meta">
        <span>🧩 ${p.mod_count || mods.length} Mods</span>
        <span>📅 ${date}</span>
        <span>👤 ${esc(p.username || 'Anonym')}</span>
        <span>❤ ${p.likes || 0}</span>
      </div>
      <div class="comm-card-footer">
        <button class="comm-load-btn" onclick="loadCommunityPackById('${p.id}')">⬇ Laden & bearbeiten</button>
        <button class="comm-like-btn" onclick="likeCommunityPack('${p.id}', this)">❤</button>
      </div>
    </div>`;
  }).join('');
}

function setCommunityFilter(filter, btn) {
  _communityFilter = filter;
  document.querySelectorAll('.comm-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderCommunityPacks();
}

function filterCommunityPacks() {
  renderCommunityPacks();
}

function loadCommunityPackById(id) {
  const p = _allCommunityPacks.find(x => x.id === id);
  if (!p) {
    showToast('⚠ Pack nicht gefunden – bitte Seite neu laden.');
    return;
  }
  if (!applyPublicPackData(p)) {
    showToast('⚠ Pack enthält keine gültigen Mods.');
    return;
  }
  showPage('builder');
  showToast('✅ "' + (p.name || 'Pack') + '" geladen – ' + MODS.length + ' Mods!');
}

async function likeCommunityPack(id, btn) {
  btn.classList.add('comm-like-btn--liked');
  btn.disabled = true;
  await sb.from('public_packs').update({ likes: sb.rpc('increment') }).eq('id', id).catch(() => {});
  btn.textContent = '❤ +1';
}

/* ── Drag & Drop helpers ── */
function dzDrag(e,id){e.preventDefault();document.getElementById(id).classList.add("dragover");}
function dzLeave(id){document.getElementById(id).classList.remove("dragover");}

/* ═══════ FIX ═══════ */
let fixPackData=null;
function dzDropFix(e){e.preventDefault();dzLeave("fixDZ");if(e.dataTransfer.files[0])parseFix(e.dataTransfer.files[0]);}
function loadFixPack(inp){if(inp.files[0])parseFix(inp.files[0]);}
function clearFixDZ(e){
  e.stopPropagation(); fixPackData=null;
  document.getElementById("fixDZ").classList.remove("loaded");
  document.getElementById("fixDZ-icon").textContent="💾";
  document.getElementById("fixDZ-label").textContent="Fehlerhafte .mrpack hier ablegen oder klicken";
  ["fixDZ-name","fixDZ-stats"].forEach(id=>document.getElementById(id).textContent="");
  document.getElementById("fixDZ-clear").style.display="none";
  document.getElementById("fixFile").value="";
  document.getElementById("fixOptions").style.display="none";
  document.getElementById("fixBtn").disabled=true;
  document.getElementById("fixLog").style.display="none";
  document.getElementById("fixStats").style.display="none";
  document.getElementById("fixStatus").textContent="";
}
async function parseFix(file){
  document.getElementById("fixStatus").textContent="Lese "+file.name+"...";
  try{
    const zip=await JSZip.loadAsync(file);
    const idx=zip.file("modrinth.index.json");
    if(!idx)throw new Error("Keine modrinth.index.json gefunden");
    const index=JSON.parse(await idx.async("string"));
    fixPackData={index,fileName:file.name};
    const mc=(index.dependencies||{}).minecraft||"";
    const fl=(index.dependencies||{})["fabric-loader"]||"";
    const mods=index.files.filter(f=>f.path.startsWith("mods/")).length;
    const rps=index.files.filter(f=>f.path.startsWith("resourcepacks/")).length;
    document.getElementById("fixDZ").classList.add("loaded");
    document.getElementById("fixDZ-icon").textContent="✅";
    document.getElementById("fixDZ-label").textContent="";
    document.getElementById("fixDZ-name").textContent=index.name||file.name;
    document.getElementById("fixDZ-stats").textContent=mods+" Mods"+(rps?", "+rps+" TP":"")+(mc?" • MC "+mc:"")+(fl?" • Fabric "+fl:"");
    document.getElementById("fixDZ-clear").style.display="block";
    document.getElementById("fixOptions").style.display="block";
    document.getElementById("fixBtn").disabled=false;
    if(mc)document.getElementById("fixMcVersion").value=mc;
    document.getElementById("fixStatus").textContent="";
  }catch(e){document.getElementById("fixStatus").textContent="Fehler: "+e.message;}
}
function fixLog(msg,cls){
  const el=document.getElementById("fixLog");el.style.display="block";
  const line=document.createElement("div");line.className=cls||"log-dim";line.textContent=msg;
  el.appendChild(line);el.scrollTop=el.scrollHeight;
}
async function runFix(){
  if(!fixPackData)return;
  const btn=document.getElementById("fixBtn");btn.disabled=true;
  document.getElementById("fixLog").innerHTML="";document.getElementById("fixLog").style.display="block";
  document.getElementById("fixStats").style.display="none";
  document.getElementById("fixProgressWrap").style.display="block";
  const mcVersion=document.getElementById("fixMcVersion").value.trim();
  const loaderMin=document.getElementById("fixLoaderMin").value.trim()||"0.18.3";
  const updateAll=document.getElementById("fixUpdateAll").checked;
  const removeBroken=document.getElementById("fixRemoveBroken").checked;
  const origIndex=fixPackData.index;
  fixLog("Pack: "+(origIndex.name||fixPackData.fileName),"log-info");
  fixLog("MC: "+(mcVersion||"?")+"  Fabric: "+((origIndex.dependencies||{})["fabric-loader"]||"?")+" → "+loaderMin,"log-info");
  fixLog("─".repeat(50),"log-dim");
  const newFiles=[];let ok=0,updated=0,failed=0;
  const total=origIndex.files.length;
  for(let i=0;i<total;i++){
    const file=origIndex.files[i];
    const isRP=file.path.startsWith("resourcepacks/");
    const fname=file.path.split("/").pop();
    document.getElementById("fixProgressBar").style.width=Math.round(i/total*100)+"%";
    document.getElementById("fixStatus").textContent="("+(i+1)+"/"+total+") "+fname;
    if(!updateAll){newFiles.push(file);ok++;fixLog("  ○ "+fname,"log-dim");continue;}
    let slug=null;
    if(file.downloads&&file.downloads.length){const m=file.downloads[0].match(/\/data\/([^/]+)\//);if(m)slug=m[1];}
    if(!slug){fixLog("  ? "+fname+" (kein Slug, behalten)","log-warn");newFiles.push(file);ok++;continue;}
    const ver=await fetchVersionById(slug,mcVersion,isRP);
    if(!ver){
      if(removeBroken){fixLog("  ✗ "+fname+" (entfernt)","log-err");failed++;}
      else{fixLog("  ✗ "+fname+" (nicht gefunden, behalten)","log-warn");newFiles.push(file);failed++;}
      continue;
    }
    const nf=ver.files.find(f=>f.primary)||ver.files[0];
    const np=(isRP?"resourcepacks":"mods")+"/"+nf.filename;
    if(nf.filename===fname){fixLog("  ✓ "+fname+" v"+ver.version_number,"log-ok");ok++;}
    else{fixLog("  ↑ "+fname+" → "+nf.filename+" v"+ver.version_number,"log-warn");updated++;}
    newFiles.push({path:np,hashes:nf.hashes,env:file.env||{client:"required",server:"unsupported"},downloads:[nf.url],fileSize:nf.size});
  }
  document.getElementById("fixProgressBar").style.width="100%";
  const newDeps=Object.assign({},origIndex.dependencies||{},{"fabric-loader":loaderMin});
  if(mcVersion)newDeps.minecraft=mcVersion;
  const newIndex={formatVersion:origIndex.formatVersion||1,game:"minecraft",versionId:origIndex.versionId||"1.0.0",name:origIndex.name||"Fixed Pack",summary:(origIndex.summary||"")+" [repaired]",files:newFiles,dependencies:newDeps};
  fixLog("─".repeat(50),"log-dim");
  fixLog("Fabric Loader: "+((origIndex.dependencies||{})["fabric-loader"]||"?")+" → "+loaderMin,"log-ok");
  fixLog("Fertig: "+ok+" OK, "+updated+" aktualisiert, "+failed+" fehlgeschlagen","log-info");
  document.getElementById("fixStats").style.display="flex";
  document.getElementById("fsOk").textContent=ok;document.getElementById("fsUpd").textContent=updated;document.getElementById("fsFail").textContent=failed;
  const zip=new JSZip();zip.file("modrinth.index.json",JSON.stringify(newIndex,null,2));zip.folder("overrides");
  const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
  const fn=(origIndex.name||"fixed-pack").replace(/\s+/g,"_")+"-fixed.mrpack";
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();a.remove();
  document.getElementById("fixStatus").textContent="✅ Gespeichert: "+fn;
  btn.textContent="🔥 Nochmals reparieren";btn.disabled=false;
}
async function fetchVersionById(projectId, mcVersion, isRP) {
  if (isRP) {
    for (const p of [mcVersion ? "?game_versions=%5B%22"+mcVersion+"%22%5D" : "", ""]) {
      try {
        const r = await fetch(API+"/project/"+projectId+"/version"+p, {headers:{"User-Agent":"mctoolkit/1.0"}});
        if (r.status === 429) { await sleep(1500); }
        if (!r.ok) continue;
        const l = await r.json();
        if (Array.isArray(l) && l.length) return l.find(v=>v.version_type==="release") || l[0];
      } catch(e) {}
    }
    return null;
  }
  for (const ld of ["fabric","quilt"]) {
    for (const mp of [mcVersion ? "&game_versions=%5B%22"+mcVersion+"%22%5D" : "", ""]) {
      try {
        const r = await fetch(API+"/project/"+projectId+"/version?loaders=%5B%22"+ld+"%22%5D"+mp, {headers:{"User-Agent":"mctoolkit/1.0"}});
        if (r.status === 429) { await sleep(1500); }
        if (!r.ok) continue;
        const l = await r.json();
        if (!Array.isArray(l) || !l.length) continue;
        return l.find(v=>v.version_type==="release") || l[0];
      } catch(e) {}
    }
  }
  return null;
}

/* ═══════ MERGE ═══════ */
let mpackData=[null,null];
function dzDropM(e,id,num){e.preventDefault();dzLeave(id);if(e.dataTransfer.files[0])parseMpack(e.dataTransfer.files[0],num);}
function loadMpack(inp,num){if(inp.files[0])parseMpack(inp.files[0],num);}
function clearMDZ(e,num){
  e.stopPropagation();mpackData[num-1]=null;const id="mdz"+num;
  document.getElementById(id).classList.remove("loaded");
  document.getElementById(id+"-name").textContent="";document.getElementById(id+"-stats").textContent="";
  document.getElementById(id+"-clear").style.display="none";document.getElementById("mf"+num).value="";
  updateMergePreview();
}
async function parseMpack(file,num){
  document.getElementById("mergeStatus").textContent="Lese "+file.name+"...";
  try{
    const zip=await JSZip.loadAsync(file);const idx=zip.file("modrinth.index.json");
    if(!idx)throw new Error("Keine modrinth.index.json");
    const index=JSON.parse(await idx.async("string"));mpackData[num-1]={index,fileName:file.name};
    const mc=(index.dependencies||{}).minecraft||"";
    const mods=index.files.filter(f=>f.path.startsWith("mods/")).length;
    const rps=index.files.filter(f=>f.path.startsWith("resourcepacks/")).length;
    const id="mdz"+num;document.getElementById(id).classList.add("loaded");
    document.getElementById(id+"-name").textContent=index.name||file.name;
    document.getElementById(id+"-stats").textContent=mods+" Mods"+(rps?", "+rps+" TP":"")+(mc?" • MC "+mc:"");
    document.getElementById(id+"-clear").style.display="block";
    document.getElementById("mergeStatus").textContent="";updateMergePreview();
  }catch(e){document.getElementById("mergeStatus").textContent="Fehler: "+e.message;}
}
function updateMergePreview(){
  const preview=document.getElementById("mergePreview"),btn=document.getElementById("mergeBtn");
  if(!mpackData[0]||!mpackData[1]){preview.style.display="none";btn.disabled=true;return;}
  const all=[...mpackData[0].index.files,...mpackData[1].index.files];
  const seen=new Map();const unique=[];const dups=[];
  all.forEach(f=>{const k=f.path.split("/").pop().toLowerCase();if(seen.has(k))dups.push(k);else{seen.set(k,true);unique.push(f);}});
  const mc=unique.filter(f=>f.path.startsWith("mods/")).length;
  const rp=unique.filter(f=>f.path.startsWith("resourcepacks/")).length;
  preview.style.display="block";btn.disabled=false;
  document.getElementById("mergeStats").innerHTML=
    mstat(mc,"Mods gesamt","green")+(rp?mstat(rp,"Texture Packs","purple"):"")+
    (dups.length?mstat(dups.length,"Duplikate entfernt","yellow"):"");
  const cs=document.getElementById("conflictSection"),cl=document.getElementById("conflictList");
  if(dups.length){cs.style.display="block";cl.innerHTML="";dups.forEach(d=>{const r=document.createElement("div");r.className="conflict-item";r.innerHTML='<span>'+esc(d)+'</span><span class="conflict-badge">Duplikat</span>';cl.appendChild(r);});}
  else cs.style.display="none";
  document.getElementById("mergeName").value=(mpackData[0].index.name||"Pack 1")+" + "+(mpackData[1].index.name||"Pack 2");
}
function mstat(num,label,color){return'<div class="merge-stat"><span class="ms-num '+color+'">'+num+'</span><span class="ms-label">'+label+'</span></div>';}
async function doMerge(){
  if(!mpackData[0]||!mpackData[1])return;
  const all=[...mpackData[0].index.files,...mpackData[1].index.files];
  const seen=new Map();const unique=[];
  all.forEach(f=>{const k=f.path.split("/").pop().toLowerCase();if(!seen.has(k)){seen.set(k,true);unique.push(f);}});
  const dep=Object.assign({},mpackData[0].index.dependencies||{},mpackData[1].index.dependencies||{});
  const idx={formatVersion:1,game:"minecraft",versionId:document.getElementById("mergeVersion").value.trim()||"1.0.0",
    name:document.getElementById("mergeName").value.trim()||"Merged Pack",
    summary:"Zusammengeführt aus: "+mpackData[0].index.name+" + "+mpackData[1].index.name,
    files:unique,dependencies:dep};
  const zip=new JSZip();zip.file("modrinth.index.json",JSON.stringify(idx,null,2));zip.folder("overrides");
  const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
  const fn=idx.name.replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_\-+]/g,"")+".mrpack";
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();a.remove();
  document.getElementById("mergeStatus").textContent="✅ "+unique.length+" Dateien → "+fn;
}

/* ═══════ BUILDER ═══════ */
let MODS=[];
let RESOURCEPACKS=[];

async function detectAndResolve(q){
  try{const r=await fetch(API+"/project/"+encodeURIComponent(q),{headers:{"User-Agent":"mctoolkit/1.0"}});if(r.ok){const p=await r.json();return{slug:p.slug,name:p.title,type:p.project_type};}}catch(e){}
  try{const r=await fetch(API+"/search?query="+encodeURIComponent(q)+"&limit=1",{headers:{"User-Agent":"mctoolkit/1.0"}});if(r.ok){const d=await r.json();if(d.hits&&d.hits.length){const h=d.hits[0];return{slug:h.slug,name:h.title,type:h.project_type};}}}catch(e){}
  return null;
}
function updateBuildBtn() {
  const btn = document.getElementById('buildBtn');
  if (!btn) return;
  const empty = MODS.length === 0 && RESOURCEPACKS.length === 0;
  btn.disabled = empty;
  btn.title = empty ? 'Bitte mindestens einen Mod hinzufügen' : '';
  const fixBtn = document.getElementById('autoFixBtn');
  if (fixBtn) fixBtn.disabled = empty;
  const fixMyBtn = document.getElementById('fixMyListBtn');
  if (fixMyBtn) fixMyBtn.disabled = empty;
}

function renderMods(){
  const el=document.getElementById("modList");el.innerHTML="";
  const filtered = (typeof activeCatFilter !== 'undefined' && activeCatFilter !== 'all')
    ? MODS.filter(m => m.cat === activeCatFilter)
    : MODS;
  if(!filtered.length){
    el.innerHTML = MODS.length
      ? '<div class="empty-hint">Keine Mods in dieser Kategorie</div>'
      : '<div class="empty-hint">Noch keine Mods</div>';
  }
  let lc="";
  filtered.forEach(m=>{
    if(m.cat!==lc){if(lc){const hr=document.createElement("div");hr.style.cssText="border-top:1px solid var(--border);margin:3px 0 0";el.appendChild(hr);}const s=document.createElement("div");s.className="sect-lbl";s.textContent=m.cat;el.appendChild(s);lc=m.cat;}
    el.appendChild(makeRow(m,"mod"));
  });
  document.getElementById("modCount").textContent=MODS.length;updateSubtitle();updateBuildBtn();
}
function renderRPs(){
  const el=document.getElementById("rpList");el.innerHTML="";
  if(!RESOURCEPACKS.length){el.innerHTML='<div class="empty-hint">Noch keine Texture Packs</div>';}
  RESOURCEPACKS.forEach(r=>el.appendChild(makeRow(r,"rp")));
  document.getElementById("rpCount").textContent=RESOURCEPACKS.length;updateSubtitle();updateBuildBtn();
}
function makeRow(item,type){
  const d=document.createElement("div");d.className="mod-item";d.id="row-"+type+"-"+item.slug;
  d.innerHTML='<span class="mi-name">'+esc(item.name)+'<span class="badge '+type+'">'+esc(item.slug)+'</span></span>'+
    '<span class="st" id="st-'+type+'-'+item.slug+'">–</span>'+
    '<button class="rm-btn" onclick="removeItem(\''+type+'\',\''+item.slug.replace(/'/g,"\\'")+'\')" title="Entfernen">✕</button>';
  return d;
}
function updateSubtitle(){}
function removeItem(type,slug){if(packLocked){showToast("🔒 Pack gesperrt – erst entsperren");return;}pushUndo();if(type==="mod")MODS=MODS.filter(m=>m.slug!==slug);else RESOURCEPACKS=RESOURCEPACKS.filter(r=>r.slug!==slug);type==="mod"?renderMods():renderRPs();}
function has(slug,type){return(type==="mod"?MODS:RESOURCEPACKS).some(m=>m.slug===slug);}
function addResolved(result,cat){
  const isRP=result.type==="resourcepack";const type=isRP?"resourcepack":"mod";
  if(has(result.slug,type))return false;
  pushUndo();
  if(isRP){RESOURCEPACKS.push({slug:result.slug,name:result.name});renderRPs();}
  else{MODS.push({slug:result.slug,name:result.name,cat:cat||"Hinzugefügt"});renderMods();}
  return true;
}

// Known dependency map — slug → required deps
const DEP_MAP = {
  'iris': ['sodium'],
  'indium': ['sodium'],
  'sodium-extra': ['sodium'],
  'reeses-sodium-options': ['sodium'],
  'lithium': [],
  'clickcrystals': ['fabric-api'],
  'crystalvault': ['fabric-api'],
  'minihud': ['malilib'],
  'itemscroller': ['malilib'],
  'tweakeroo': ['malilib'],
  'appleskin': ['fabric-api'],
  'jade': ['fabric-api'],
  'roughly-enough-items': ['fabric-api'],
  'waystones': ['fabric-api'],
  'xaeros-minimap': [],
  'xaeros-world-map': [],
  'shulkerboxtooltip': ['fabric-api'],
  'inventoryhud': [],
  'betterf3': ['fabric-api'],
  'zoomify': ['fabric-api'],
};

async function checkAndAddDeps(addedSlugs) {
  const needed = new Set();
  for (const slug of addedSlugs) {
    const deps = DEP_MAP[slug];
    if (deps) deps.forEach(d => { if (!has(d, 'mod')) needed.add(d); });
  }
  if (!needed.size) return [];
  const added = [];
  for (const dep of needed) {
    const res = await detectAndResolve(dep);
    if (res && addResolved(res, 'Auto-Dependency')) added.push(res.name || dep);
  }
  if (added.length) showDepNotification(added);
  return added;
}

function showDepNotification(names) {
  const box = document.getElementById('depNotifications');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'dep-toast';
  div.innerHTML = `<span class="dep-toast-icon">✦</span><span>Automatisch hinzugefügt: <b>${names.join(', ')}</b></span>`;
  box.appendChild(div);
  setTimeout(() => div.remove(), 6000);
}

function showModErrors(errors) {
  const box = document.getElementById('depNotifications');
  if (!box || !errors.length) return;
  const div = document.createElement('div');
  div.className = 'mod-error-strip';
  div.innerHTML = errors.map(e =>
    `<div class="mod-error-row"><span class="mod-error-tag">Nicht gefunden</span> ${esc(e)}</div>`
  ).join('');
  box.appendChild(div);
  setTimeout(() => div.remove(), 8000);
}

async function fixMyModList() {
  const btn = document.getElementById('fixMyListBtn');
  btn.disabled = true; btn.textContent = '⏳ Wird analysiert...';
  const st = document.getElementById('statusText');
  st.textContent = 'Analysiere Mod-Liste...';
  document.getElementById('depNotifications').innerHTML = '';

  const allSlugs = MODS.map(m => m.slug);
  const depsAdded = [];
  const errors = [];

  // Check each mod's deps
  for (const slug of allSlugs) {
    const deps = DEP_MAP[slug] || [];
    for (const dep of deps) {
      if (!has(dep, 'mod')) {
        const res = await detectAndResolve(dep);
        if (res && addResolved(res, 'Auto-Dependency')) depsAdded.push(res.name || dep);
      }
    }
  }

  // Remove duplicates
  const seen = new Set();
  MODS = MODS.filter(m => { if (seen.has(m.slug)) return false; seen.add(m.slug); return true; });
  renderMods();

  if (depsAdded.length) showDepNotification(depsAdded);
  st.textContent = depsAdded.length
    ? `✅ ${depsAdded.length} Dependency(ies) ergänzt, Duplikate entfernt.`
    : '✅ Mod-Liste ist sauber – keine Fehler gefunden.';

  btn.disabled = false; btn.textContent = '🔧 Fix my mod list — Fehler beheben & Dependencies ergänzen';
}
function toggleBlock(w){const inner=document.getElementById(w==="mod"?"modList":"rpList");const arrow=document.getElementById(w==="mod"?"modArrow":"rpArrow");const h=inner.style.display==="none";inner.style.display=h?"":"none";arrow.className="lh-arrow"+(h?"":" closed");}
let sTimer=null;
document.getElementById("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")doSearch();});
document.getElementById("searchInput").addEventListener("input",function(){clearTimeout(sTimer);if(this.value.trim().length>=2)sTimer=setTimeout(doSearch,380);else hideResults();});
async function doSearch(){
  const q=document.getElementById("searchInput").value.trim();if(!q)return;
  const resEl=document.getElementById("searchResults");resEl.style.display="block";
  resEl.innerHTML='<div style="padding:8px 10px;font-size:.73rem;color:var(--muted)">Suche...</div>';
  try{
    const r=await fetch(API+"/search?query="+encodeURIComponent(q)+"&limit=8",{headers:{"User-Agent":"mctoolkit/1.0"}});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const hits=(await r.json()).hits||[];
    if(!hits.length){resEl.innerHTML='<div style="padding:8px 10px;font-size:.73rem;color:var(--muted)">Keine Ergebnisse.</div>';return;}
    resEl.innerHTML="";
    hits.forEach(h=>{
      const isRP=h.project_type==="resourcepack",bt=isRP?"rp":"mod",tl=isRP?"Texture Pack":"Mod",ai=has(h.slug,isRP?"resourcepack":"mod");
      const d=document.createElement("div");d.className="sr-item";
      d.innerHTML='<div class="sr-info"><div><span class="sr-name">'+esc(h.title)+'</span><span class="sr-slug '+bt+'">'+h.slug+'</span><span class="detect-badge '+bt+'">'+tl+'</span>'+(h.downloads?'<span class="sr-dls">↓ '+formatDls(h.downloads)+'</span>':'')+'</div><div class="sr-desc">'+esc((h.description||"").substring(0,72))+'</div></div>'+
        '<button class="sr-add-btn '+bt+(ai?" added":"")+'\" id="srb-'+h.slug+'">'+(ai?"Bereits drin":"+ Hinzufügen")+'</button>';
      if(!ai){d.querySelector(".sr-add-btn").addEventListener("click",ev=>{ev.stopPropagation();addResolved({slug:h.slug,name:h.title,type:h.project_type});const b=document.getElementById("srb-"+h.slug);if(b){b.textContent="Bereits drin";b.className="sr-add-btn "+bt+" added";}});}
      resEl.appendChild(d);
    });
  }catch(e){resEl.innerHTML='<div style="padding:8px 10px;font-size:.73rem;color:var(--red)">Fehler: '+e.message+'</div>';}
}
function hideResults(){document.getElementById("searchResults").style.display="none";}
document.addEventListener("click",e=>{if(!e.target.closest(".search-section"))hideResults();});
async function addFromPaste(){
  const qs=document.getElementById("pasteArea").value.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);if(!qs.length)return;
  const st=document.getElementById("statusText");st.textContent="Erkenne "+qs.length+" Einträge...";
  document.getElementById('depNotifications').innerHTML = '';
  let am=0,ar=0,sk=0,nf=[],addedSlugs=[];
  for(let i=0;i<qs.length;i++){
    st.textContent="("+(i+1)+"/"+qs.length+") "+qs[i]+"...";
    const res=await detectAndResolve(qs[i]);
    if(!res){nf.push(qs[i]);continue;}
    const added=addResolved(res,"Hinzugefügt");
    if(!added){sk++;continue;}
    if(res.type!=="resourcepack") addedSlugs.push(res.slug);
    res.type==="resourcepack"?ar++:am++;
  }
  document.getElementById("pasteArea").value="";
  let msg="";if(am)msg+=am+" Mods";if(ar)msg+=(msg?", ":"")+ar+" Texture Packs";if(msg)msg+=" hinzugefügt";
  if(sk)msg+=(msg?", ":"")+sk+" bereits vorhanden";
  st.textContent=msg||"Nichts hinzugefügt.";
  if(nf.length) showModErrors(nf);
  if(addedSlugs.length) await checkAndAddDeps(addedSlugs);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchVersion(slug, mcVersion, isRP, retries=2) {
  if (isRP) {
    for (const p of [mcVersion ? "?game_versions=%5B%22"+mcVersion+"%22%5D" : "", ""]) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          if (attempt > 0) await sleep(600 * attempt);
          const r = await fetch(API+"/project/"+slug+"/version"+p, {headers:{"User-Agent":"mctoolkit/1.0"}});
          if (r.status === 429) { await sleep(1500); continue; }
          if (!r.ok) break;
          const l = await r.json();
          if (Array.isArray(l) && l.length) return l.find(v=>v.version_type==="release") || l[0];
          break;
        } catch(e) { if (attempt === retries) break; await sleep(400); }
      }
    }
    return null;
  }
  for (const ld of ["fabric","quilt"]) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) await sleep(600 * attempt);
        const url = API+"/project/"+slug+"/version?game_versions=%5B%22"+mcVersion+"%22%5D&loaders=%5B%22"+ld+"%22%5D";
        const r = await fetch(url, {headers:{"User-Agent":"mctoolkit/1.0"}});
        if (r.status === 429) { await sleep(1500); continue; }
        if (!r.ok) break;
        const l = await r.json();
        if (!Array.isArray(l) || !l.length) break;
        return l.find(v=>v.version_type==="release") || l[0];
      } catch(e) { if (attempt === retries) break; await sleep(400); }
    }
  }
  // Fallback: try without MC version filter
  for (const ld of ["fabric","quilt"]) {
    try {
      const r = await fetch(API+"/project/"+slug+"/version?loaders=%5B%22"+ld+"%22%5D", {headers:{"User-Agent":"mctoolkit/1.0"}});
      if (!r.ok) continue;
      const l = await r.json();
      if (!Array.isArray(l) || !l.length) continue;
      return l.find(v=>v.version_type==="release") || l[0];
    } catch(e) {}
  }
  return null;
}
function setSt(id,txt,cls){const e=document.getElementById(id);if(e){e.textContent=txt;e.className="st "+(cls||"");}}
/* ── Platform selector logic ── */
let selectedPlatform = null;

function selectPlatform(p) {
  selectedPlatform = p;
  document.querySelectorAll('.platform-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('pc' + p.charAt(0).toUpperCase() + p.slice(1)).classList.add('selected');
  document.getElementById('platformConfirm').classList.add('ready');
}

function confirmPlatform() {
  if (!selectedPlatform) return;
  localStorage.setItem('mctoolkit_platform', selectedPlatform);
  document.getElementById('platformOverlay').style.display = 'none';
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  setTimeout(() => document.getElementById('app').scrollIntoView({behavior:'smooth', block:'start'}), 80);
  // Show indicator
  const ind = document.getElementById('platformIndicator');
  ind.style.display = 'flex';
  document.getElementById('piDot').className = 'pi-dot ' + selectedPlatform;
  document.getElementById('piName').className = 'pi-name ' + selectedPlatform;
  document.getElementById('piName').textContent = selectedPlatform === 'modrinth' ? 'Modrinth' : 'CurseForge';
  document.getElementById('piFormat').textContent = selectedPlatform === 'modrinth' ? '.mrpack' : '.zip';
  // Update button label
  const btn = document.getElementById('buildBtn');
  if (btn) btn.textContent = selectedPlatform === 'modrinth'
    ? '⬇ .mrpack generieren & downloaden'
    : '⬇ CurseForge .zip generieren & downloaden';
  // Run any pending preset load from hero template buttons
  if (window._pendingPresetLoad) { setTimeout(window._pendingPresetLoad, 200); window._pendingPresetLoad = null; }
}

function changePlatform() {
  selectedPlatform = null;
  localStorage.removeItem('mctoolkit_platform');
  document.getElementById('platformOverlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  document.getElementById('platformIndicator').style.display = 'none';
  document.querySelectorAll('.platform-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('platformConfirm').classList.remove('ready');
}

/* ── Modrinth .mrpack build ── */
async function createMrpackBlob(mcV, pName, pVer, fl, progress) {
  const all=[...MODS.map(m=>({...m,isRP:false})),...RESOURCEPACKS.map(r=>({...r,isRP:true}))];
  const fe=[],nf=[];
  for(let i=0;i<all.length;i++){
    const item=all[i],sid="st-"+(item.isRP?"rp":"mod")+"-"+item.slug;
    progress?.({ step:'item', index:i, total:all.length, item });
    setSt(sid,"suche...","busy");
    if(i > 0) await sleep(120);
    const ver=await fetchVersion(item.slug,mcV,item.isRP);
    if(!ver||!ver.files||!ver.files.length){nf.push(item.name);setSt(sid,"nicht gefunden","err");continue;}
    const f=ver.files.find(x=>x.primary)||ver.files[0];
    fe.push({path:(item.isRP?"resourcepacks":"mods")+"/"+f.filename,hashes:f.hashes,env:{client:"required",server:"unsupported"},downloads:[f.url],fileSize:f.size});
    setSt(sid,"v"+ver.version_number,"ok");
  }
  if(!fe.length) throw new Error("Keine Dateien gefunden. Pruefe die Modliste und Minecraft-Version.");
  progress?.({ step:'zip', found:fe.length, missing:nf });
  const idx={formatVersion:1,game:"minecraft",versionId:pVer,name:pName,summary:"MC Toolkit - Modpack fuer MC "+mcV,files:fe,dependencies:{minecraft:mcV,"fabric-loader":fl}};
  const zip=new JSZip();
  zip.file("modrinth.index.json",JSON.stringify(idx,null,2));
  zip.folder("overrides");
  const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
  const fn=pName.replace(/\s+/g,"_")+"-"+mcV+".mrpack";
  return { blob, filename:fn, index:idx, found:fe.length, missing:nf };
}

async function buildMrpack(btn, st, pb, mcV, pName, pVer, fl) {
  try {
    const pack=await createMrpackBlob(mcV,pName,pVer,fl, ev => {
      if(ev.step==='item'){
        st.textContent="("+(ev.index+1)+"/"+ev.total+") "+ev.item.name+"...";
        pb.style.width=Math.round(ev.index/ev.total*100)+"%";
      }
      if(ev.step==='zip'){
        pb.style.width="100%";
        st.textContent="Erstelle .mrpack...";
      }
    });
    const a=document.createElement("a");a.href=URL.createObjectURL(pack.blob);a.download=pack.filename;document.body.appendChild(a);a.click();a.remove();
    st.textContent=pack.found+" Mods/Packs"+(pack.missing.length?" - Nicht gefunden: "+pack.missing.join(", "):" - Alle OK!")+" -> "+pack.filename;
    btn.innerHTML="Download nochmals";btn.disabled=false;
    showOpenInApp(pack.filename, "modrinth");
  } catch(e) {
    st.textContent=e.message||"Fehler beim Erstellen";
    btn.disabled=false;
  }
}

/* ── CurseForge .zip build ── */
async function buildCurseForgePack(btn, st, pb, mcV, pName, pVer, fl) {
  const allMods=[...MODS];
  const allRPs=[...RESOURCEPACKS];
  const all=[...allMods.map(m=>({...m,isRP:false})),...allRPs.map(r=>({...r,isRP:true}))];
  
  const resolvedMods=[];
  const notFound=[];

  for(let i=0;i<all.length;i++){
    const item=all[i];
    const sid="st-"+(item.isRP?"rp":"mod")+"-"+item.slug;
    setSt(sid,"suche...","busy");
    st.textContent="("+(i+1)+"/"+all.length+") "+item.name+"...";
    pb.style.width=Math.round(i/all.length*100)+"%";
    if(i > 0) await sleep(120);
    const ver=await fetchVersion(item.slug,mcV,item.isRP);
    if(!ver||!ver.files||!ver.files.length){
      // Fallback: try without MC version filter
      const verFallback=await fetchVersion(item.slug,'',item.isRP);
      if(!verFallback||!verFallback.files||!verFallback.files.length){
        notFound.push(item.name);setSt(sid,"wird manuell eingetragen","warn");
        // Still add to list so modlist.html has it with modrinth link
        resolvedMods.push({name:item.name,slug:item.slug,version:'?',filename:item.slug+'.jar',url:'https://modrinth.com/mod/'+item.slug,isRP:item.isRP,manual:true});
        continue;
      }
      const ff=verFallback.files.find(x=>x.primary)||verFallback.files[0];
      resolvedMods.push({name:item.name,slug:item.slug,version:verFallback.version_number+'*',filename:ff.filename,url:ff.url,isRP:item.isRP,manual:false});
      setSt(sid,"v"+verFallback.version_number+" (neueste)","busy");
      continue;
    }
    const f=ver.files.find(x=>x.primary)||ver.files[0];
    resolvedMods.push({
      name: item.name,
      slug: item.slug,
      version: ver.version_number,
      filename: f.filename,
      url: f.url,
      isRP: item.isRP,
      manual: false
    });
    setSt(sid,"v"+ver.version_number,"ok");
  }

  pb.style.width="100%";
  if(!resolvedMods.length){st.textContent="Keine Mods gefunden!";btn.disabled=false;return;}
  st.textContent="Erstelle CurseForge .zip...";

  // Build CurseForge manifest.json
  // CurseForge format – files array needs CF project/file IDs which we don't have from Modrinth.
  // We use empty files array and put mods in overrides/mods instead.
  const manifest = {
    minecraft: {
      version: mcV,
      modLoaders: [{ id: "fabric-"+fl, primary: true }]
    },
    manifestType: "minecraftModpack",
    manifestVersion: 1,
    name: pName,
    version: pVer,
    author: "MC Toolkit",
    files: [],
    overrides: "overrides"
  };

  // modlist.html
  const modRows = resolvedMods
    .filter(m=>!m.isRP)
    .map(m=>'<li><a href="'+m.url+'">'+m.name+' ('+m.version+')</a> – <code>'+m.filename+'</code></li>')
    .join('\n');
  const rpRows = resolvedMods
    .filter(m=>m.isRP)
    .map(m=>'<li><a href="'+m.url+'">'+m.name+' ('+m.version+')</a> – <code>'+m.filename+'</code></li>')
    .join('\n');

  const modlistHtml = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8">
<title>${pName} – Modliste</title>
<style>
  body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;background:#1a1a2e;color:#f0f0ff}
  h1{color:#4ade80}h2{color:#a78bfa;margin-top:2rem}
  a{color:#60a5fa}li{margin:.4rem 0}code{background:#2d2d44;padding:1px 5px;border-radius:3px;font-size:.85em}
  .note{background:#2d1a00;border:1px solid #f16436;border-radius:8px;padding:1rem;margin:1rem 0;color:#fcd34d}
</style></head><body>
<h1>⚡ ${pName}</h1>
<p>Minecraft ${mcV} · Fabric ${fl} · ${resolvedMods.length} Mods/Packs</p>
<div class="note">
  <strong>⚠ Manuelle Installation erforderlich:</strong><br>
  Da die Mods von Modrinth stammen, sind keine CurseForge-IDs verfügbar.<br>
  Bitte lade die Mods über die Links unten herunter und lege sie in deinen <code>mods/</code> Ordner.
</div>
<h2>🧩 Mods (${resolvedMods.filter(m=>!m.isRP).length})</h2>
<ul>${modRows}</ul>
${rpRows ? '<h2>🎨 Texture Packs ('+resolvedMods.filter(m=>m.isRP).length+')</h2><ul>'+rpRows+'</ul>' : ''}
<hr style="border-color:#333;margin:2rem 0">
<p style="color:#666;font-size:.8rem">Erstellt mit MC Toolkit · <a href="https://crystalpack-builder.netlify.app">crystalpack-builder.netlify.app</a></p>
</body></html>`;

  // README
  const readme = `# ${pName} – CurseForge Pack

Minecraft: ${mcV}
Fabric Loader: ${fl}
Erstellt mit: MC Toolkit

## Installation in CurseForge Launcher

1. CurseForge App öffnen
2. "Create Custom Profile" klicken
3. Minecraft ${mcV} + Fabric ${fl} auswählen
4. Profil öffnen → Ordner öffnen
5. Mods aus der modlist.html herunterladen und in /mods/ legen
6. Texture Packs in /resourcepacks/ legen

## Mod-Liste

${resolvedMods.filter(m=>!m.isRP).map(m=>'- '+m.name+' v'+m.version+': '+m.url).join('\n')}
${resolvedMods.filter(m=>m.isRP).length ? '\n## Texture Packs\n'+resolvedMods.filter(m=>m.isRP).map(m=>'- '+m.name+' v'+m.version+': '+m.url).join('\n') : ''}
`;

  const zip=new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest,null,2));
  zip.file("modlist.html", modlistHtml);
  zip.file("README.txt", readme);
  zip.folder("overrides").folder("mods");
  zip.folder("overrides").folder("resourcepacks");

  const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
  const fn=pName.replace(/\s+/g,"_")+"-"+mcV+"-curseforge.zip";
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();a.remove();
  const manualCount = resolvedMods.filter(m=>m.manual).length;
  st.textContent=resolvedMods.length+" Mods"+(manualCount?" · "+manualCount+" manuell (Link in modlist.html)":" · Alle OK!")+" → "+fn;
  btn.innerHTML="⬇ Nochmals downloaden";btn.disabled=false;
  showOpenInApp(fn, "curseforge");
}

/* ── Main build dispatcher ── */
async function showDownloadPreview() {
  const all = [...MODS, ...RESOURCEPACKS];
  if (!all.length) return;

  // Remove old preview
  document.getElementById('dlPreviewBox')?.remove();

  const box = document.createElement('div');
  box.id = 'dlPreviewBox';
  box.className = 'dl-preview';
  const okCount = all.length;
  box.innerHTML = `
    <div class="dl-preview-title">📋 Vorschau – ${all.length} Einträge werden verpackt
      <button onclick="document.getElementById('dlPreviewBox').remove()" style="margin-left:auto;background:none;border:none;color:var(--muted);cursor:pointer;font-size:.85rem">✕</button>
    </div>
    <div class="dl-preview-summary">
      <span class="dp-sum-ok">✓ ${MODS.length} Mods</span>
      ${RESOURCEPACKS.length ? `<span class="dp-sum-ok">✓ ${RESOURCEPACKS.length} Texture Packs</span>` : ''}
      <span style="color:var(--muted);margin-left:auto">${selectedPlatform === 'modrinth' ? '.mrpack' : '.zip'}</span>
    </div>
    ${MODS.map(m => `<div class="dl-preview-row"><span class="dp-ok">✓</span><span class="dp-name">${esc(m.name)}</span><span class="dp-ver">${esc(m.slug)}</span></div>`).join('')}
    ${RESOURCEPACKS.map(r => `<div class="dl-preview-row"><span class="dp-ok">🎨</span><span class="dp-name">${esc(r.name)}</span><span class="dp-ver">${esc(r.slug)}</span></div>`).join('')}
  `;

  // Insert before build button
  const buildBtn = document.getElementById('buildBtn');
  buildBtn.parentNode.insertBefore(box, buildBtn);
}

async function buildPack(){
  if(!selectedPlatform){
    document.getElementById('platformOverlay').style.display='flex';return;
  }

  // Show download preview first
  await showDownloadPreview();

  const btn=document.getElementById("buildBtn"),pw=document.getElementById("progressWrap"),pb=document.getElementById("progressBar"),st=document.getElementById("statusText");
  btn.disabled=true;pw.style.display="block";pb.style.width="0%";
  const mcV=document.getElementById("mcVersion").value;
  const pName=document.getElementById("packName").value.trim()||"My Modpack";
  const pVer=document.getElementById("packVersion").value.trim()||"1.0.0";
  const fl=document.getElementById("fabricLoader").value.trim()||"0.18.3";
  if (!navigator.onLine) {
    st.textContent = '⚠ Keine Internetverbindung – bitte prüfe deine Verbindung und versuche es erneut.';
    st.style.color = 'var(--red)';
    btn.disabled = false; return;
  }
  st.style.color = '';
  if(!window.JSZip){st.textContent="JSZip fehlt!";btn.disabled=false;return;}
  if(selectedPlatform==='modrinth'){
    await buildMrpack(btn,st,pb,mcV,pName,pVer,fl);
  } else {
    await buildCurseForgePack(btn,st,pb,mcV,pName,pVer,fl);
  }
}

function esc(s){return(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}


/* ══════════════════════════════════════════════════════════════════════
   PACK VORLAGEN
══════════════════════════════════════════════════════════════════════ */
const TEMPLATES = [
  {
    id: "pvp-crystal",
    name: "SMP Crystal PvP",
    icon: "💎",
    color: "blue",
    desc: "Dein echtes SMP Crystal Pack – 85 Mods inkl. ClickCrystals, Litematica, Voxy, Performance & mehr.",
    tags: [{t:"PvP",c:"blue"},{t:"Crystal",c:"blue"},{t:"SMP",c:"purple"}],
    mods: [
      {slug:"anchoroptimizer",name:"Anchor Optimizer",cat:"PvP"},
      {slug:"appleskin",name:"AppleSkin",cat:"HUD"},
      {slug:"architectury",name:"Architectury API",cat:"Library"},
      {slug:"bactromod",name:"BactroMod",cat:"PvP"},
      {slug:"better-ping-display",name:"Better Ping Display",cat:"HUD"},
      {slug:"betterhurtcam",name:"Better Hurt Cam",cat:"QoL"},
      {slug:"bettershieldsounds",name:"Better Shield Sounds",cat:"QoL"},
      {slug:"betterstats",name:"Better Stats",cat:"HUD"},
      {slug:"cape-provider",name:"Cape Provider",cat:"Cosmetic"},
      {slug:"chunky-fabric",name:"Chunky",cat:"Performance"},
      {slug:"clickcrystals",name:"ClickCrystals",cat:"PvP"},
      {slug:"cloth-config",name:"Cloth Config",cat:"Library"},
      {slug:"crosshairaddons",name:"Crosshair Addons",cat:"HUD"},
      {slug:"cullleaves",name:"Cull Leaves",cat:"Performance"},
      {slug:"dynamic-fps",name:"Dynamic FPS",cat:"Performance"},
      {slug:"entityculling",name:"EntityCulling",cat:"Performance"},
      {slug:"exordium",name:"Exordium",cat:"Performance"},
      {slug:"fabric-api",name:"Fabric API",cat:"Library"},
      {slug:"fabric-language-kotlin",name:"Fabric Language Kotlin",cat:"Library"},
      {slug:"fastexp",name:"FastExp",cat:"Performance"},
      {slug:"fastquit",name:"FastQuit",cat:"QoL"},
      {slug:"gamma-utils",name:"Gamma Utils",cat:"QoL"},
      {slug:"herosanchoroptimizer",name:"Heros Anchor Optimizer",cat:"PvP"},
      {slug:"holo-damage-indicator",name:"Holo Damage Indicator",cat:"HUD"},
      {slug:"hologram-api",name:"Hologram API",cat:"Library"},
      {slug:"hotbar-keys",name:"Hotbar Keys",cat:"QoL"},
      {slug:"hotbar-presets",name:"Hotbar Presets",cat:"QoL"},
      {slug:"immediatelyfast",name:"ImmediatelyFast",cat:"Performance"},
      {slug:"inventoryhud",name:"InventoryHUD+",cat:"HUD"},
      {slug:"jade",name:"Jade",cat:"HUD"},
      {slug:"joinautosprintmod",name:"Join Auto Sprint",cat:"QoL"},
      {slug:"justzoom",name:"JustZoom",cat:"QoL"},
      {slug:"konkrete",name:"Konkrete",cat:"Library"},
      {slug:"krypton",name:"Krypton",cat:"Performance"},
      {slug:"libipn",name:"LibIPN",cat:"Library"},
      {slug:"litematica",name:"Litematica",cat:"Building"},
      {slug:"lithium",name:"Lithium",cat:"Performance"},
      {slug:"malilib",name:"MaLiLib",cat:"Library"},
      {slug:"marlow-crystal-optimizer",name:"Marlow Crystal Optimizer",cat:"PvP"},
      {slug:"midnightlib",name:"MidnightLib",cat:"Library"},
      {slug:"modmenu",name:"Mod Menu",cat:"QoL"},
      {slug:"moreculling",name:"MoreCulling",cat:"Performance"},
      {slug:"mousetweaks",name:"Mouse Tweaks",cat:"QoL"},
      {slug:"myresourcepack",name:"My Resource Pack",cat:"QoL"},
      {slug:"no-resource-pack-warnings",name:"No Resource Pack Warnings",cat:"QoL"},
      {slug:"no-death-animation",name:"No Death Animation",cat:"PvP"},
      {slug:"no-fog",name:"No Fog",cat:"QoL"},
      {slug:"packetfixer",name:"PacketFixer",cat:"Network"},
      {slug:"placeholder-api",name:"Placeholder API",cat:"Library"},
      {slug:"potioncounter",name:"Potion Counter",cat:"HUD"},
      {slug:"ptp",name:"PTP",cat:"PvP"},
      {slug:"pvpoptimizer",name:"PvP Optimizer",cat:"PvP"},
      {slug:"reeses-sodium-options",name:"Reese's Sodium Options",cat:"Performance"},
      {slug:"reflex",name:"Reflex",cat:"PvP"},
      {slug:"remove-warden-effect",name:"Remove Warden Effect",cat:"QoL"},
      {slug:"remove-reloading-screen",name:"Remove Reloading Screen",cat:"QoL"},
      {slug:"screenshotmetadata",name:"Screenshot Metadata",cat:"QoL"},
      {slug:"searchables",name:"Searchables",cat:"Library"},
      {slug:"secondchat",name:"Second Chat",cat:"QoL"},
      {slug:"serverpingerfixer",name:"Server Pinger Fixer",cat:"Network"},
      {slug:"shield-status",name:"Shield Status",cat:"HUD"},
      {slug:"shulkerboxtooltip",name:"Shulker Box Tooltip",cat:"QoL"},
      {slug:"simpleresourceloader",name:"Simple Resource Loader",cat:"QoL"},
      {slug:"smooth-boot",name:"Smooth Boot",cat:"Performance"},
      {slug:"smoothjoin",name:"SmoothJoin",cat:"Network"},
      {slug:"snappy-tappy",name:"Snappy Tappy",cat:"PvP"},
      {slug:"sodium",name:"Sodium",cat:"Performance"},
      {slug:"sodium-extra",name:"Sodium Extra",cat:"Performance"},
      {slug:"sound-controller",name:"Sound Controller",cat:"QoL"},
      {slug:"sprint-after-death",name:"Sprint After Death",cat:"PvP"},
      {slug:"status-effect-bars",name:"Status Effect Bars",cat:"HUD"},
      {slug:"totem-counter",name:"Totem Counter",cat:"HUD"},
      {slug:"ukulib",name:"UkuLib",cat:"Library"},
      {slug:"simple-voice-chat",name:"Simple Voice Chat",cat:"Social"},
      {slug:"voxy",name:"Voxy",cat:"Performance"},
      {slug:"wi-freecam",name:"WI Freecam",cat:"QoL"},
      {slug:"xaeros-minimap",name:"Xaero's Minimap",cat:"HUD"},
      {slug:"xaeros-world-map",name:"Xaero's World Map",cat:"HUD"},
      {slug:"yacl",name:"YetAnotherConfigLib",cat:"Library"},
    ],
    rps: []
  },
  {
    id: "performance",
    name: "Pure Performance",
    icon: "⚡",
    color: "green",
    desc: "Maximale FPS durch die besten Performance-Mods – kein Schnickschnack.",
    tags: [{t:"Performance",c:"green"},{t:"FPS Boost",c:"green"},{t:"Lite",c:"yellow"}],
    mods: [
      {slug:"sodium",name:"Sodium",cat:"Performance"},
      {slug:"lithium",name:"Lithium",cat:"Performance"},
      {slug:"ferritecore",name:"FerriteCore",cat:"Performance"},
      {slug:"krypton",name:"Krypton",cat:"Performance"},
      {slug:"entityculling",name:"EntityCulling",cat:"Performance"},
      {slug:"dynamic-fps",name:"Dynamic FPS",cat:"Performance"},
      {slug:"chunky",name:"Chunky",cat:"Performance"},
      {slug:"sodium-extra",name:"Sodium Extra",cat:"Performance"},
      {slug:"reeses-sodium-options",name:"Reese's Sodium Options",cat:"Performance"},
      {slug:"remove-reloading-screen",name:"Remove Reloading Screen",cat:"QoL"},
    ],
    rps: []
  },
  {
    id: "vanilla-plus",
    name: "Vanilla+",
    icon: "🌿",
    color: "yellow",
    desc: "Vanilla-Feeling behalten aber mit QoL-Verbesserungen und Performance-Boost.",
    tags: [{t:"Vanilla",c:"yellow"},{t:"QoL",c:"green"},{t:"Chill",c:"green"}],
    mods: [
      {slug:"sodium",name:"Sodium",cat:"Performance"},
      {slug:"lithium",name:"Lithium",cat:"Performance"},
      {slug:"ferritecore",name:"FerriteCore",cat:"Performance"},
      {slug:"dynamic-fps",name:"Dynamic FPS",cat:"Performance"},
      {slug:"appleskin",name:"AppleSkin",cat:"QoL"},
      {slug:"shulkerboxtooltip",name:"Shulker Box Tooltip",cat:"QoL"},
      {slug:"mousetweaks",name:"Mouse Tweaks",cat:"QoL"},
      {slug:"zoomify",name:"Zoomify",cat:"QoL"},
      {slug:"inventoryhud",name:"Inventory HUD+",cat:"QoL"},
      {slug:"betterf3",name:"BetterF3",cat:"QoL"},
      {slug:"remove-reloading-screen",name:"Remove Reloading Screen",cat:"QoL"},
      {slug:"gamma-utils",name:"Gamma Utils",cat:"QoL"},
    ],
    rps: []
  },
  {
    id: "speedrun",
    name: "Speedrun",
    icon: "🏃",
    color: "orange",
    desc: "Für Speedrunner – Ticks, Timer, Seed-Anzeige und maximale Performance.",
    tags: [{t:"Speedrun",c:"orange"},{t:"Timer",c:"orange"},{t:"Performance",c:"green"}],
    mods: [
      {slug:"sodium",name:"Sodium",cat:"Performance"},
      {slug:"lithium",name:"Lithium",cat:"Performance"},
      {slug:"ferritecore",name:"FerriteCore",cat:"Performance"},
      {slug:"krypton",name:"Krypton",cat:"Performance"},
      {slug:"entityculling",name:"EntityCulling",cat:"Performance"},
      {slug:"dynamic-fps",name:"Dynamic FPS",cat:"Performance"},
      {slug:"betterf3",name:"BetterF3",cat:"HUD"},
      {slug:"minihud",name:"MiniHUD",cat:"HUD"},
      {slug:"zoomify",name:"Zoomify",cat:"QoL"},
      {slug:"no-hurt-cam",name:"No Hurt Cam",cat:"QoL"},
    ],
    rps: []
  },
  {
    id: "building",
    name: "Builder / Creative",
    icon: "🏗",
    color: "purple",
    desc: "Für Builder und Creative-Spieler – bessere Schemen, Inventar und Übersicht.",
    tags: [{t:"Building",c:"purple"},{t:"Creative",c:"purple"},{t:"QoL",c:"green"}],
    mods: [
      {slug:"sodium",name:"Sodium",cat:"Performance"},
      {slug:"lithium",name:"Lithium",cat:"Performance"},
      {slug:"ferritecore",name:"FerriteCore",cat:"Performance"},
      {slug:"dynamic-fps",name:"Dynamic FPS",cat:"Performance"},
      {slug:"shulkerboxtooltip",name:"Shulker Box Tooltip",cat:"QoL"},
      {slug:"mousetweaks",name:"Mouse Tweaks",cat:"QoL"},
      {slug:"zoomify",name:"Zoomify",cat:"QoL"},
      {slug:"appleskin",name:"AppleSkin",cat:"QoL"},
      {slug:"betterf3",name:"BetterF3",cat:"HUD"},
      {slug:"minihud",name:"MiniHUD",cat:"HUD"},
      {slug:"inventoryhud",name:"Inventory HUD+",cat:"HUD"},
      {slug:"gamma-utils",name:"Gamma Utils",cat:"QoL"},
    ],
    rps: []
  },
  {
    id: "fullpack",
    name: "Vollständiger Pack",
    icon: "🔮",
    color: "red",
    desc: "Der komplette vorinstallierte Pack – alle 22 Mods für Crystal PvP & Performance.",
    tags: [{t:"Alle Mods",c:"red"},{t:"PvP",c:"blue"},{t:"Performance",c:"green"},{t:"HUD",c:"purple"}],
    mods: [
      {slug:"sodium",name:"Sodium",cat:"Performance"},
      {slug:"lithium",name:"Lithium",cat:"Performance"},
      {slug:"ferritecore",name:"FerriteCore",cat:"Performance"},
      {slug:"krypton",name:"Krypton",cat:"Performance"},
      {slug:"entityculling",name:"EntityCulling",cat:"Performance"},
      {slug:"dynamic-fps",name:"Dynamic FPS",cat:"Performance"},
      {slug:"chunky",name:"Chunky",cat:"Performance"},
      {slug:"clickcrystals",name:"ClickCrystals",cat:"PvP / Crystal"},
      {slug:"clientsidecrystals",name:"Client Side Crystals",cat:"PvP / Crystal"},
      {slug:"hcscr",name:"HCSCR",cat:"PvP / Crystal"},
      {slug:"totem-counter",name:"Totem Counter",cat:"PvP / Crystal"},
      {slug:"minihud",name:"MiniHUD",cat:"HUD"},
      {slug:"appleskin",name:"AppleSkin",cat:"HUD"},
      {slug:"betterf3",name:"BetterF3",cat:"HUD"},
      {slug:"shulkerboxtooltip",name:"Shulker Box Tooltip",cat:"HUD"},
      {slug:"inventoryhud",name:"Inventory HUD+",cat:"HUD"},
      {slug:"zoomify",name:"Zoomify",cat:"QoL"},
      {slug:"mousetweaks",name:"Mouse Tweaks",cat:"QoL"},
      {slug:"no-hurt-cam",name:"No Hurt Cam",cat:"QoL"},
      {slug:"remove-reloading-screen",name:"Remove Reloading Screen",cat:"QoL"},
      {slug:"reeses-sodium-options",name:"Reese's Sodium Options",cat:"QoL"},
      {slug:"gamma-utils",name:"Gamma Utils",cat:"QoL"},
    ],
    rps: []
  },
];

let selectedTemplate = null;

function openTemplates() {
  const grid = document.getElementById('tmGrid');
  grid.innerHTML = '';
  TEMPLATES.forEach(t => {
    const card = document.createElement('div');
    card.className = 'tm-card' + (selectedTemplate === t.id ? ' selected' : '');
    card.dataset.color = t.color;
    card.dataset.id = t.id;
    const tagHtml = t.tags.map(tg => '<span class="tm-tag '+tg.c+'">'+tg.t+'</span>').join('');
    card.innerHTML =
      '<div class="tm-icon">'+t.icon+'</div>' +
      '<div class="tm-name">'+t.name+'</div>' +
      '<div class="tm-desc">'+t.desc+'</div>' +
      '<div class="tm-count">'+t.mods.length+' Mods'+(t.rps.length?' + '+t.rps.length+' TP':'')+'</div>' +
      '<div class="tm-tags">'+tagHtml+'</div>';
    card.addEventListener('click', () => pickTemplate(t.id));
    grid.appendChild(card);
  });
  // Show warning if mods already exist
  const warn = document.getElementById('tmWarning');
  warn.style.display = (MODS.length > 0) ? 'block' : 'none';
  document.getElementById('templatesOverlay').classList.add('open');
}

function closeTemplates() {
  document.getElementById('templatesOverlay').classList.remove('open');
}

function pickTemplate(id) {
  selectedTemplate = id;
  document.querySelectorAll('.tm-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });
  const t = TEMPLATES.find(x => x.id === id);
  document.getElementById('tmInfo').innerHTML =
    '<b>' + t.name + '</b> – ' + t.mods.length + ' Mods' +
    (t.rps.length ? ' + ' + t.rps.length + ' Texture Packs' : '');
  const applyBtn = document.getElementById('tmApply');
  applyBtn.classList.add('ready');
}

function applyTemplate() {
  if (!selectedTemplate) return;
  const t = TEMPLATES.find(x => x.id === selectedTemplate);
  if (!t) return;
  MODS = t.mods.map(m => ({...m}));
  RESOURCEPACKS = t.rps.map(r => ({...r}));
  renderMods();
  renderRPs();
  closeTemplates();
  // Scroll to mod list
  setTimeout(() => document.getElementById('page-builder').querySelector('.lists-wrap').scrollIntoView({behavior:'smooth', block:'start'}), 150);
  document.getElementById('statusText').textContent = '✓ Vorlage "' + t.name + '" geladen – ' + t.mods.length + ' Mods.';
}

// Close on backdrop click
document.addEventListener('click', e => {
  const overlay = document.getElementById('templatesOverlay');
  if (e.target === overlay) closeTemplates();
});


/* ══════════════════════════════════════════════════════════════════════
   MOD-PROFILE (localStorage)
══════════════════════════════════════════════════════════════════════ */
/* ══ SUPABASE INIT ═════════════════════════════════════════════ */
const { createClient } = supabase;
const sb = createClient('https://lcirexhyxbljpfzdlfqu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaXJleGh5eGJsanBmemRsZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDczNzUsImV4cCI6MjA5MDIyMzM3NX0.-gbQiXU0ONEsO2UK0c1JIky7qxoJmT43iV9pE0dov70');

let currentUser = null;

/* ══ AUTH STATE ════════════════════════════════════════════════ */
sb.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  updateNavAuth();
  if (event === 'SIGNED_IN') {
    closeAuth();
    showToast('✅ Willkommen, ' + (currentUser.email || 'Nutzer') + '!', 3000);
    // Migrate local profiles to cloud on first sign-in
    migrateLocalToCloud();
  }
  if (event === 'SIGNED_OUT') {
    showToast('↩ Abgemeldet');
    updateNavAuth();
  }
});

// Check session on load
sb.auth.getSession().then(({ data }) => {
  currentUser = data.session?.user ?? null;
  updateNavAuth();
});

function updateNavAuth() {
  const btn      = document.getElementById('authNavBtn');
  const labelEl  = document.getElementById('authNavLabel');
  const emailEl  = document.getElementById('udEmail');

  // Settings panel guest/user toggle
  const spGuest = document.getElementById('spGuest');
  const spUser  = document.getElementById('spUser');
  const spUsername = document.getElementById('spUsername');
  const spEmailEl  = document.getElementById('spEmail');
  const spAvatar   = document.getElementById('spAvatar');
  const nsLabel    = document.getElementById('navSettingsLabel');

  if (currentUser) {
    const name = currentUser.email?.split('@')[0] || 'Account';
    // Old auth button (may not exist in new nav)
    if (btn) { btn.classList.add('signed-in'); }
    if (labelEl) labelEl.textContent = name;
    if (emailEl) emailEl.textContent = currentUser.email || '';
    // Settings panel
    if (spGuest) spGuest.style.display = 'none';
    if (spUser)  spUser.style.display  = '';
    if (spUsername) spUsername.textContent = name;
    if (spEmailEl)  spEmailEl.textContent  = currentUser.email || '';
    if (spAvatar)   spAvatar.textContent   = name.charAt(0).toUpperCase();
    if (nsLabel)    nsLabel.textContent    = name;
    // Sync theme button states
    const saved = localStorage.getItem('mctoolkit_theme') || 'dark';
    document.getElementById('themeOptDark')?.classList.toggle('active',  saved === 'dark');
    document.getElementById('themeOptLight')?.classList.toggle('active', saved === 'light');
    document.getElementById('themeOptDark2')?.classList.toggle('active',  saved === 'dark');
    document.getElementById('themeOptLight2')?.classList.toggle('active', saved === 'light');
    // Owner check → auto-activate VIP
    checkAndActivateOwner(currentUser.email);
  } else {
    if (btn) { btn.classList.remove('signed-in'); }
    if (labelEl) labelEl.textContent = 'Anmelden';
    if (nsLabel) nsLabel.textContent = 'Einstellungen';
    if (spGuest) spGuest.style.display = '';
    if (spUser)  spUser.style.display  = 'none';
  }
}

/* ══ AUTH MODAL ════════════════════════════════════════════════ */
let authMode = 'login';

function toggleSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.toggle('open');
}
function closeSettingsPanel() {
  document.getElementById('settingsPanel')?.classList.remove('open');
}
// Close when clicking outside
document.addEventListener('click', e => {
  const btn   = document.getElementById('navSettingsBtn');
  const panel = document.getElementById('settingsPanel');
  if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
    panel.classList.remove('open');
  }
});

function openAuth() {
  document.getElementById('authOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('authMsg').textContent = '';
  document.getElementById('authEmail').focus();
}

function requireLoginThen(fn) {
  if (currentUser) { fn(); return; }
  showToast('🔒 Bitte zuerst anmelden!');
  setTimeout(() => openAuth(), 500);
}
function closeAuth() {
  document.getElementById('authOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}
function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('tabRegister').classList.toggle('active', mode === 'register');
  document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Anmelden' : 'Account erstellen';
  document.getElementById('authMsg').textContent = '';
  document.getElementById('authPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
}

async function submitAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const pass  = document.getElementById('authPassword').value;
  const btn   = document.getElementById('authSubmitBtn');
  const msg   = document.getElementById('authMsg');
  if (!email || !pass) { msg.className='auth-msg err'; msg.textContent='⚠ Bitte E-Mail und Passwort eingeben.'; return; }
  btn.disabled = true;
  btn.textContent = '…';
  msg.className = 'auth-msg'; msg.textContent = '';
  try {
    let res;
    if (authMode === 'login') {
      res = await sb.auth.signInWithPassword({ email, password: pass });
    } else {
      res = await sb.auth.signUp({ email, password: pass });
      if (!res.error && res.data?.user && !res.data?.session) {
        msg.className = 'auth-msg ok';
        msg.textContent = '✅ Bestätigungsmail gesendet! Bitte E-Mail prüfen.';
        btn.disabled = false; btn.textContent = 'Account erstellen'; return;
      }
    }
    if (res.error) throw res.error;
  } catch(e) {
    msg.className = 'auth-msg err';
    msg.textContent = '⚠ ' + (e.message || 'Fehler beim Anmelden');
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'Anmelden' : 'Account erstellen';
  }
}

async function signInGitHub() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: location.origin + location.pathname }
  });
  if (error) showToast('⚠ GitHub Login fehlgeschlagen: ' + error.message);
}

async function signOut() {
  closeUserMenu();
  await sb.auth.signOut();
}

/* User menu */
function toggleUserMenu() {
  if (!currentUser) { openAuth(); return; }
  document.getElementById('userDropdown').classList.toggle('open');
}
function closeUserMenu() {
  document.getElementById('userDropdown').classList.remove('open');
}
document.addEventListener('click', e => {
  const wrap = document.querySelector('.user-menu-wrap');
  if (wrap && !wrap.contains(e.target)) closeUserMenu();
  if (e.target === document.getElementById('authOverlay')) closeAuth();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAuth();
});

/* ══ CLOUD PROFILES ════════════════════════════════════════════ */
const PROFILES_KEY = 'mctoolkit_profiles';

function getProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]'); }
  catch(e) { return []; }
}
function setProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

async function migrateLocalToCloud() {
  const local = getProfiles();
  if (!local.length || !currentUser) return;
  for (const p of local) {
    await sb.from('profiles').upsert({
      user_id: currentUser.id,
      name: p.name,
      data: p,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,name' });
  }
  showToast('☁ ' + local.length + ' lokale Profile in die Cloud synchronisiert', 3500);
}

async function saveProfile() {
  const name = document.getElementById('profileNameInput').value.trim();
  if (!name) {
    document.getElementById('pmSaveMsg').style.color = 'var(--red)';
    document.getElementById('pmSaveMsg').textContent = '⚠ Bitte einen Namen eingeben.';
    return;
  }
  const profile = {
    id: Date.now(),
    name,
    packName:    document.getElementById('packName').value.trim(),
    packVersion: document.getElementById('packVersion').value.trim(),
    mcVersion:   document.getElementById('mcVersion').value,
    fabricLoader:document.getElementById('fabricLoader').value.trim(),
    mods: MODS.map(m => ({...m})),
    rps:  RESOURCEPACKS.map(r => ({...r})),
    savedAt: new Date().toLocaleString('de-DE')
  };

  const msg = document.getElementById('pmSaveMsg');

  if (currentUser) {
    // Save to cloud
    const { error } = await sb.from('profiles').upsert({
      user_id:    currentUser.id,
      name:       name,
      data:       profile,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,name' });
    if (error) {
      msg.style.color = 'var(--red)';
      msg.textContent = '⚠ Fehler: ' + error.message;
      return;
    }
    msg.style.color = 'var(--green)';
    msg.textContent = '☁ Profil in der Cloud gespeichert!';
  } else {
    // Save locally
    const profiles = getProfiles();
    const dupIdx = profiles.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    if (dupIdx !== -1) profiles[dupIdx] = profile; else profiles.unshift(profile);
    setProfiles(profiles);
    msg.style.color = 'var(--green)';
    msg.textContent = '💾 Lokal gespeichert (anmelden für Cloud-Sync)';
  }
  renderProfileList();
}

async function loadProfile(idOrName) {
  let p;
  if (currentUser) {
    const { data } = await sb.from('profiles')
      .select('data').eq('user_id', currentUser.id).eq('name', idOrName).single();
    p = data?.data;
  } else {
    const profiles = getProfiles();
    p = profiles.find(x => x.id === idOrName);
  }
  if (!p) return;
  MODS = p.mods.map(m => ({...m}));
  RESOURCEPACKS = p.rps.map(r => ({...r}));
  document.getElementById('packName').value    = p.packName    || p.name;
  document.getElementById('packVersion').value = p.packVersion || '1.0.0';
  document.getElementById('mcVersion').value   = p.mcVersion   || '1.21.11';
  document.getElementById('fabricLoader').value= p.fabricLoader|| '0.18.3';
  renderMods(); renderRPs();
  closeProfiles();
  document.getElementById('statusText').textContent = '✓ Profil "' + p.name + '" geladen – ' + p.mods.length + ' Mods.';
}

async function deleteProfile(idOrName) {
  if (currentUser) {
    await sb.from('profiles').delete().eq('user_id', currentUser.id).eq('name', idOrName);
  } else {
    setProfiles(getProfiles().filter(p => p.id !== idOrName));
  }
  renderProfileList();
}

async function renderProfileList() {
  const list = document.getElementById('pmList');
  list.innerHTML = '<div class="pm-empty" style="color:var(--muted);font-size:.8rem;padding:1rem 0">⏳ Lade Profile...</div>';

  let profiles = [];
  let isCloud = false;

  if (currentUser) {
    const { data, error } = await sb.from('profiles')
      .select('name, data, updated_at')
      .eq('user_id', currentUser.id)
      .order('updated_at', { ascending: false });
    if (!error && data) {
      profiles = data.map(row => ({ ...row.data, _name: row.name, _updatedAt: row.updated_at }));
      isCloud = true;
    }
  } else {
    profiles = getProfiles();
  }

  if (!profiles.length) {
    list.innerHTML = currentUser
      ? '<div class="pm-empty">Noch keine Cloud-Profile. Speichere deinen ersten Pack!</div>'
      : '<div class="pm-empty">Noch keine Profile.<br><button onclick="openAuth()" style="margin-top:.5rem;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);border-radius:7px;color:var(--green);font-family:var(--font);font-size:.78rem;font-weight:700;padding:5px 14px;cursor:pointer">Anmelden für Cloud-Sync ☁</button></div>';
    return;
  }

  list.innerHTML = '';
  profiles.forEach(p => {
    const key  = isCloud ? (p._name || p.name) : p.id;
    const rpTx = p.rps?.length ? ' · ' + p.rps.length + ' TP' : '';
    const badge = isCloud ? '<span class="cloud-badge">☁ Cloud</span>' : '';
    const saved = isCloud
      ? new Date(p._updatedAt).toLocaleString('de-DE')
      : (p.savedAt || '?');
    const item = document.createElement('div');
    item.className = 'pm-item';
    item.innerHTML =
      '<div class="pm-item-info">' +
        '<div class="pm-item-name">' + esc(p.name || p._name) + badge + '</div>' +
        '<div class="pm-item-meta">' +
          esc(p.mcVersion||'?') + ' · Fabric ' + esc(p.fabricLoader||'?') +
          ' · ' + (p.mods?.length||0) + ' Mods' + rpTx +
        '</div>' +
        '<span class="pm-item-badge">' + esc(saved) + '</span>' +
      '</div>' +
      '<div class="pm-item-actions">' +
        '<button class="pm-load-btn" onclick="loadProfile(' + JSON.stringify(key) + ')">↓ Laden</button>' +
        '<button class="pm-del-btn"  onclick="deleteProfile(' + JSON.stringify(key) + ')" title="Löschen">🗑</button>' +
      '</div>';
    list.appendChild(item);
  });
}

function openProfiles() {
  document.getElementById('profileNameInput').value =
    document.getElementById('packName').value.trim() || '';
  document.getElementById('pmSaveMsg').textContent = '';
  renderProfileList();
  document.getElementById('profilesOverlay').classList.add('open');
}
function closeProfiles() {
  document.getElementById('profilesOverlay').classList.remove('open');
}

// Close on backdrop
document.addEventListener('click', e => {
  if (e.target === document.getElementById('profilesOverlay')) closeProfiles();
});


/* ══════════════════════════════════════════════════════════════════════
   VERSIONS-UPDATE
══════════════════════════════════════════════════════════════════════ */
let upgPackData = null;

function dzDropUpg(e) { e.preventDefault(); dzLeave('upgDZ'); if(e.dataTransfer.files[0]) parseUpgPack(e.dataTransfer.files[0]); }
function loadUpgPack(inp) { if(inp.files[0]) parseUpgPack(inp.files[0]); }

function clearUpgDZ(e) {
  e.stopPropagation(); upgPackData = null;
  const dz = document.getElementById('upgDZ');
  dz.classList.remove('loaded');
  document.getElementById('upgDZ-icon').textContent = '📦';
  document.getElementById('upgDZ-label').textContent = 'Bestehendes .mrpack hier ablegen oder klicken';
  ['upgDZ-name','upgDZ-stats'].forEach(id => document.getElementById(id).textContent = '');
  document.getElementById('upgDZ-clear').style.display = 'none';
  document.getElementById('upgFile').value = '';
  document.getElementById('upgOptions').style.display = 'none';
  document.getElementById('upgBtn').disabled = true;
  document.getElementById('upgLog').style.display = 'none';
  document.getElementById('upgStats').style.display = 'none';
  document.getElementById('upgStatus').textContent = '';
}

async function parseUpgPack(file) {
  document.getElementById('upgStatus').textContent = 'Lese ' + file.name + '...';
  try {
    const zip = await JSZip.loadAsync(file);
    const idx = zip.file('modrinth.index.json');
    if (!idx) throw new Error('Keine modrinth.index.json gefunden');
    const index = JSON.parse(await idx.async('string'));
    upgPackData = { index, fileName: file.name };

    const mc = (index.dependencies || {}).minecraft || '?';
    const fl = (index.dependencies || {})['fabric-loader'] || '?';
    const mods = index.files.filter(f => f.path.startsWith('mods/')).length;
    const rps  = index.files.filter(f => f.path.startsWith('resourcepacks/')).length;

    document.getElementById('upgDZ').classList.add('loaded');
    document.getElementById('upgDZ-icon').textContent = '✅';
    document.getElementById('upgDZ-label').textContent = '';
    document.getElementById('upgDZ-name').textContent = index.name || file.name;
    document.getElementById('upgDZ-stats').textContent =
      mods + ' Mods' + (rps ? ', ' + rps + ' TP' : '') +
      ' • MC ' + mc + ' • Fabric ' + fl;
    document.getElementById('upgDZ-clear').style.display = 'block';
    document.getElementById('upgOptions').style.display = 'block';
    document.getElementById('upgBtn').disabled = false;

    // Set from-version label
    document.getElementById('upgFromVer').textContent = mc;

    // Auto-select a sensible target (next version up)
    const versions = ['1.20.1','1.20.4','1.21.1','1.21.4','1.21.11','1.26.1.2','1.26.2','26.1.2','26.2'];
    const currentIdx = versions.indexOf(mc);
    const sel = document.getElementById('upgTargetVer');
    if (currentIdx !== -1 && currentIdx < versions.length - 1) {
      sel.value = versions[currentIdx + 1];
    } else {
      sel.value = '1.21.11';
    }

    document.getElementById('upgStatus').textContent = '';
  } catch(e) {
    document.getElementById('upgStatus').textContent = 'Fehler: ' + e.message;
  }
}

function upgLog(msg, cls) {
  const el = document.getElementById('upgLog');
  el.style.display = 'block';
  const line = document.createElement('div');
  line.className = cls || 'log-dim';
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

async function runUpgrade() {
  if (!upgPackData) return;
  const btn = document.getElementById('upgBtn');
  btn.disabled = true;
  document.getElementById('upgLog').innerHTML = '';
  document.getElementById('upgLog').style.display = 'block';
  document.getElementById('upgStats').style.display = 'none';
  document.getElementById('upgProgressWrap').style.display = 'block';
  document.getElementById('upgProgressBar').style.width = '0%';

  const origIndex = upgPackData.index;
  const fromVer   = (origIndex.dependencies || {}).minecraft || '?';
  const targetVer = document.getElementById('upgTargetVer').value;
  const keepLoader  = document.getElementById('upgKeepLoader').checked;
  const removeFailed = document.getElementById('upgRemoveFailed').checked;
  const origLoader   = (origIndex.dependencies || {})['fabric-loader'] || '0.18.3';

  if (fromVer === targetVer) {
    document.getElementById('upgStatus').textContent = '⚠ Quell- und Ziel-Version sind identisch!';
    btn.disabled = false;
    return;
  }

  upgLog('Pack: ' + (origIndex.name || upgPackData.fileName), 'log-info');
  upgLog('MC: ' + fromVer + ' → ' + targetVer, 'log-info');
  upgLog('Fabric Loader: ' + origLoader + (keepLoader ? ' (beibehalten)' : ' → neueste'), 'log-info');
  upgLog('─'.repeat(50), 'log-dim');

  const files = origIndex.files;
  const newFiles = [];
  let nOk = 0, nUnchanged = 0, nFail = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isRP = file.path.startsWith('resourcepacks/');
    const fname = file.path.split('/').pop();

    document.getElementById('upgProgressBar').style.width = Math.round(i / files.length * 100) + '%';
    document.getElementById('upgStatus').textContent = '(' + (i+1) + '/' + files.length + ') ' + fname;

    // Extract project ID from download URL
    let projectId = null;
    if (file.downloads && file.downloads.length) {
      const m = file.downloads[0].match(/\/data\/([^/]+)\//);
      if (m) projectId = m[1];
    }

    if (!projectId) {
      upgLog('  ? ' + fname + ' (kein Projekt-ID, behalten)', 'log-warn');
      newFiles.push(file); nUnchanged++; continue;
    }

    // Fetch version for new MC target
    const ver = await fetchVersionById(projectId, targetVer, isRP);

    if (!ver) {
      if (removeFailed) {
        upgLog('  ✗ ' + fname + ' (kein Support für ' + targetVer + ', entfernt)', 'log-err');
        nFail++;
      } else {
        upgLog('  ✗ ' + fname + ' (kein Support für ' + targetVer + ', behalten)', 'log-warn');
        newFiles.push(file);
        nFail++;
      }
      continue;
    }

    const nf = ver.files.find(f => f.primary) || ver.files[0];
    const newPath = (isRP ? 'resourcepacks' : 'mods') + '/' + nf.filename;
    const changed = nf.filename !== fname;

    if (changed) {
      upgLog('  ↑ ' + fname + ' → ' + nf.filename + ' (v' + ver.version_number + ')', 'log-ok');
      nOk++;
    } else {
      upgLog('  ✓ ' + fname + ' v' + ver.version_number + ' (bereits aktuell)', 'log-dim');
      nUnchanged++;
    }

    newFiles.push({
      path: newPath,
      hashes: nf.hashes,
      env: file.env || { client: 'required', server: 'unsupported' },
      downloads: [nf.url],
      fileSize: nf.size
    });
  }

  document.getElementById('upgProgressBar').style.width = '100%';
  upgLog('─'.repeat(50), 'log-dim');
  upgLog('Fertig: ' + nOk + ' aktualisiert, ' + nUnchanged + ' unverändert, ' + nFail + ' fehlgeschlagen', 'log-info');

  // Build new index
  const newDeps = Object.assign({}, origIndex.dependencies || {});
  newDeps.minecraft = targetVer;
  if (!keepLoader) newDeps['fabric-loader'] = '0.18.3';

  const newIndex = {
    formatVersion: origIndex.formatVersion || 1,
    game: 'minecraft',
    versionId: origIndex.versionId || '1.0.0',
    name: (origIndex.name || 'Pack') + ' [' + targetVer + ']',
    summary: (origIndex.summary || '') + ' (upgraded from ' + fromVer + ')',
    files: newFiles,
    dependencies: newDeps
  };

  // Show stats
  document.getElementById('upgStats').style.display = 'flex';
  document.getElementById('ugsOk').textContent = nOk;
  document.getElementById('ugsUnchanged').textContent = nUnchanged;
  document.getElementById('ugsFail').textContent = nFail;

  // Generate and download
  const zip = new JSZip();
  zip.file('modrinth.index.json', JSON.stringify(newIndex, null, 2));
  zip.folder('overrides');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const safeName = (origIndex.name || 'pack').replace(/\s+/g, '_');
  const fn = safeName + '-' + targetVer + '.mrpack';
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn;
  document.body.appendChild(a); a.click(); a.remove();

  const upgBlobUrl = URL.createObjectURL(blob);
  document.getElementById('upgStatus').textContent = '✅ Gespeichert: ' + fn;
  btn.textContent = '⬆ Nochmals updaten';
  btn.disabled = false;
  showOpenInApp(fn, 'modrinth', upgBlobUrl);
}


/* ══════════════════════════════════════════════════════════════════════
   OPEN IN APP
══════════════════════════════════════════════════════════════════════ */
function showOpenInApp(filename, platform, blobUrl) {
  // store for re-download
  window._oaBlobUrl  = blobUrl;
  window._oaFilename = filename;

  document.getElementById('oaFilename').textContent = filename;

  // wire download button
  const dlBtn = document.getElementById('oaDownloadBtn');
  dlBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = window._oaBlobUrl; a.download = window._oaFilename;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const isMrpack = filename.endsWith('.mrpack');

  // ── Build launcher tabs & panels ─────────────────────────────────────
  const tabsEl   = document.getElementById('oaTabs');
  const panelsEl = document.getElementById('oaPanels');
  tabsEl.innerHTML = '';
  panelsEl.innerHTML = '';

  const launchers = isMrpack
    ? [
        { id: 'mr', label: '🟢 Modrinth App', cls: 'mr' },
        { id: 'pr', label: '🔷 Prism Launcher', cls: 'pr' },
      ]
    : [
        { id: 'cf', label: '🟠 CurseForge App', cls: 'cf' },
      ];

  launchers.forEach((l, i) => {
    // Tab
    const tab = document.createElement('div');
    tab.className = 'oa-tab' + (i === 0 ? ' active ' + l.cls : '');
    tab.textContent = l.label;
    tab.dataset.panel = l.id;
    tab.dataset.cls   = l.cls;
    tab.onclick = () => {
      tabsEl.querySelectorAll('.oa-tab').forEach(t => t.classList.remove('active','mr','cf','pr'));
      panelsEl.querySelectorAll('.oa-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active', l.cls);
      document.getElementById('oa-panel-' + l.id).classList.add('active');
    };
    tabsEl.appendChild(tab);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'oa-panel' + (i === 0 ? ' active' : '');
    panel.id = 'oa-panel-' + l.id;

    let stepsHtml = '<div class="oa-panel-inner">';

    if (l.id === 'mr') {
      stepsHtml += step('mr','1','<b>Pack herunterladen</b> – klicke oben auf den grünen Download-Button')
        + step('mr','2','<b>Modrinth App öffnen</b>')
        + step('mr','3','Links in der Sidebar auf <code>Modpacks</code> klicken')
        + step('mr','4','Oben rechts auf <code>+</code> klicken → <code>Import from file</code> wählen')
        + step('mr','5','Die heruntergeladene Datei <code>' + filename + '</code> auswählen → <b>fertig!</b>')
        + '<div class="oa-hint"><b>💡 Tipp:</b> Die Datei liegt meist im <code>Downloads</code> Ordner.</div>';
    } else if (l.id === 'pr') {
      stepsHtml += step('pr','1','<b>Pack herunterladen</b> – klicke oben auf den grünen Download-Button')
        + step('pr','2','<b>Prism Launcher</b> oder <b>MultiMC</b> öffnen')
        + step('pr','3','Oben links auf <code>Add Instance</code> klicken')
        + step('pr','4','Links <code>Import</code> auswählen')
        + step('pr','5','Auf <code>Browse</code> klicken → Datei <code>' + filename + '</code> auswählen → <code>OK</code>')
        + '<div class="oa-hint"><b>💡 Tipp:</b> Direkt in Prism per Drag & Drop auf das Instanz-Fenster ziehen klappt auch!</div>';
    } else if (l.id === 'cf') {
      stepsHtml += step('cf','1','<b>Pack herunterladen</b> – klicke oben auf den grünen Download-Button')
        + step('cf','2','<b>CurseForge App</b> öffnen → links <code>Minecraft</code> wählen')
        + step('cf','3','Oben rechts auf <code>Create Custom Profile</code> klicken')
        + step('cf','4','Im Dialog oben auf <code>Import</code> klicken → Datei <code>' + filename + '</code> wählen')
        + step('cf','5','Mods aus der mitgelieferten <code>modlist.html</code> herunterladen &amp; in den <code>mods/</code> Ordner des Profils legen')
        + '<div class="oa-hint"><b>⚠ Hinweis:</b> Da die Mods von Modrinth kommen, müssen sie einmalig manuell platziert werden. Die modlist.html im ZIP enthält alle Download-Links.</div>';
    }

    stepsHtml += '</div>';
    panel.innerHTML = stepsHtml;
    panelsEl.appendChild(panel);
  });

  document.getElementById('openAppOverlay').classList.add('open');
}

function step(cls, num, text) {
  return '<div class="oa-step">'
    + '<span class="oa-step-num ' + cls + '">' + num + '</span>'
    + '<span class="oa-step-text">' + text + '</span>'
    + '</div>';
}

function closeOpenApp() {
  document.getElementById('openAppOverlay').classList.remove('open');
}

// Close on backdrop
document.addEventListener('click', e => {
  if (e.target === document.getElementById('openAppOverlay')) closeOpenApp();
});


function closeOverlayAndScroll(e, sectionId) {
  e.preventDefault();
  // Close all overlays
  const po = document.getElementById('platformOverlay');
  if (po && po.style.display !== 'none') {
    po.style.display = 'none';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
  ['templatesOverlay','profilesOverlay','openAppOverlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });
  if (sectionId === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    const target = document.getElementById(sectionId);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}


/* ══ THEME TOGGLE ══════════════════════════════════════════════ */
function setTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light');
  } else {
    document.body.classList.remove('light');
  }
  localStorage.setItem('mctoolkit_theme', theme);
  document.getElementById('themeOptDark')?.classList.toggle('active',  theme === 'dark');
  document.getElementById('themeOptLight')?.classList.toggle('active', theme === 'light');
  closeUserMenu();
  showToast(theme === 'light' ? '☀️ Helles Design aktiviert' : '🌙 Dunkles Design aktiviert');
}
// Restore saved theme on load
(function() {
  const saved = localStorage.getItem('mctoolkit_theme');
  if (saved === 'light') document.body.classList.add('light');
})();

/* ══ LEGAL MODALS ═══════════════════════════════════════════════ */
function openImprint(e)  { e.preventDefault(); document.getElementById('imprintOverlay').classList.add('open'); }
function openPrivacy(e)  { e.preventDefault(); document.getElementById('privacyOverlay').classList.add('open'); }
function openFeedback(e) { e.preventDefault(); document.getElementById('feedbackOverlay').classList.add('open'); }

document.addEventListener('click', e => {
  ['imprintOverlay','privacyOverlay','feedbackOverlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) el.classList.remove('open');
  });
});

/* ══ CATEGORY FILTER ════════════════════════════════════════════ */
let activeCatFilter = 'all';

function filterMods(btn, cat) {
  activeCatFilter = cat;
  document.querySelectorAll('.cat-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMods();
}



/* ══ FORMAT DOWNLOADS ══════════════════════════════════════════ */
function formatDls(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1_000)     return (n/1_000).toFixed(0) + 'k';
  return String(n);
}

/* ══ UNDO STACK ════════════════════════════════════════════════ */
const undoStack = [];
const MAX_UNDO  = 30;

function pushUndo() {
  undoStack.push({ mods: MODS.map(m=>({...m})), rps: RESOURCEPACKS.map(r=>({...r})) });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}
function doUndo() {
  if (!undoStack.length) {
    showToast('Nichts zum Rückgängigmachen ↩');
    return;
  }
  const prev = undoStack.pop();
  MODS = prev.mods;
  RESOURCEPACKS = prev.rps;
  renderMods(); renderRPs();
  showToast('Rückgängig gemacht ↩');
}

/* ══ TOAST NOTIFICATION ════════════════════════════════════════ */
function showToast(msg, duration=2200) {
  let t = document.getElementById('cpToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'cpToast';
    t.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(20px);background:var(--bg3);border:1px solid var(--border2);color:var(--text);font-family:var(--font);font-size:.82rem;font-weight:600;padding:9px 20px;border-radius:99px;z-index:9999;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;white-space:nowrap';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, duration);
}

/* ══ PACK SEARCH IN LIST ═══════════════════════════════════════ */
function filterPackSearch(q) {
  const term = q.toLowerCase().trim();
  document.querySelectorAll('.mod-item').forEach(row => {
    if (!term) { row.style.display = ''; return; }
    const txt = row.textContent.toLowerCase();
    row.style.display = txt.includes(term) ? '' : 'none';
  });
  document.querySelectorAll('.sect-lbl').forEach(lbl => {
    if (!term) { lbl.style.display = ''; return; }
    // hide label if no visible sibling items follow it before next label
    let next = lbl.nextElementSibling;
    let any = false;
    while (next && !next.classList.contains('sect-lbl')) {
      if (next.style.display !== 'none') any = true;
      next = next.nextElementSibling;
    }
    lbl.style.display = any ? '' : 'none';
  });
}

/* ══ SHARE VIA URL ═════════════════════════════════════════════ */
function openShareModal() {
  if (!MODS.length && !RESOURCEPACKS.length) {
    showToast('⚠ Keine Mods im Pack zum Teilen!');
    return;
  }

  // Fill pack name
  const packName = document.getElementById('packName').value.trim() || 'Mein Modpack';
  const nameEl = document.getElementById('shareName');
  if (nameEl) nameEl.value = packName;

  // Fill platform display
  const platEl = document.getElementById('sharePlatformDisplay');
  if (platEl) {
    platEl.value = selectedPlatform === 'modrinth' ? 'Modrinth (.mrpack)'
                 : selectedPlatform === 'curseforge' ? 'CurseForge (.zip)'
                 : 'Nicht gewählt';
  }

  // Fill pack content preview
  const previewEl = document.getElementById('sharePreviewList');
  if (previewEl) {
    const all = [...MODS, ...RESOURCEPACKS];
    if (all.length === 0) {
      previewEl.innerHTML = '<span style="color:var(--muted)">Keine Mods</span>';
    } else {
      previewEl.innerHTML = all.map(m =>
        `<div style="padding:2px 0;display:flex;gap:6px;align-items:center">
          <span style="color:var(--green);font-size:.7rem">✓</span>
          <span style="color:var(--text);font-weight:600">${esc(m.name)}</span>
          <span style="color:var(--muted);font-size:.68rem">${esc(m.slug)}</span>
        </div>`
      ).join('');
    }
  }

  // Show/hide needs-mods warning
  const warnEl = document.getElementById('shareNeedsMods');
  if (warnEl) warnEl.style.display = MODS.length ? 'none' : 'block';

  // Clear status
  const statusEl = document.getElementById('shareStatus');
  if (statusEl) statusEl.textContent = '';

  document.getElementById('shareOverlay').classList.add('open');
}

function generatePackCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MC-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function copyPackCode(code) {
  navigator.clipboard.writeText(code.trim()).catch(() => {});
  showToast('📋 Code ' + code.trim() + ' kopiert!');
}

function formatPackCodeInput(el) {
  let val = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (val.startsWith('MC')) val = val.slice(2);
  val = val.slice(0, 6);
  el.value = val.length > 0 ? 'MC-' + val : '';
}

function resetShareModal() {
  document.getElementById('shareFormStep').style.display = '';
  document.getElementById('shareSuccessStep').style.display = 'none';
  const btn = document.getElementById('shareSubmitBtn');
  if (btn) { btn.disabled = false; btn.textContent = '🚀 Pack veröffentlichen'; }
  const st = document.getElementById('shareStatus');
  if (st) st.textContent = '';
}

async function submitSharePack() {
  const btn = document.getElementById('shareSubmitBtn');
  const statusEl = document.getElementById('shareStatus');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '⏳ Wird veröffentlicht...';
  statusEl.textContent = '';

  if (!currentUser) {
    statusEl.textContent = '⚠ Bitte zuerst anmelden!';
    statusEl.style.color = 'var(--red)';
    btn.disabled = false; btn.textContent = '🚀 Pack veröffentlichen';
    setTimeout(() => openAuth(), 600); return;
  }
  if (!MODS.length && !RESOURCEPACKS.length) {
    statusEl.textContent = '⚠ Keine Mods im Pack!';
    statusEl.style.color = 'var(--red)';
    btn.disabled = false; btn.textContent = '🚀 Pack veröffentlichen'; return;
  }

  const name     = document.getElementById('shareName')?.value.trim() || document.getElementById('packName').value.trim() || 'Mein Modpack';
  const desc     = document.getElementById('shareDesc')?.value.trim() || '';
  const category = document.getElementById('shareCategory')?.value || 'general';
  const mcVer    = document.getElementById('mcVersion').value;
  const packCode = generatePackCode();

  try {
    const { error } = await sb.from('public_packs').insert({
      name, description: desc, category,
      platform: selectedPlatform || 'modrinth',
      mc_version: mcVer,
      mods: MODS.map(m => ({ slug: m.slug, name: m.name, cat: m.cat })),
      resource_packs: RESOURCEPACKS.map(r => ({ slug: r.slug, name: r.name })),
      pack_code: packCode,
      user_id: currentUser.id,
      username: currentUser.email?.split('@')[0] || 'User',
      mod_count: MODS.length,
      likes: 0
    });
    if (error) throw error;

    // Show success step with code
    document.getElementById('shareFormStep').style.display = 'none';
    document.getElementById('shareSuccessStep').style.display = '';
    document.getElementById('shareCodeDisplay').textContent = packCode;
    navigator.clipboard.writeText(packCode).catch(() => {});
    _communityLoaded = false; // force reload on next visit

  } catch (err) {
    console.error(err);
    statusEl.style.color = 'var(--red)';
    statusEl.textContent = '⚠ Fehler: ' + (err.message || 'Unbekannt');
    btn.disabled = false; btn.textContent = '🚀 Pack veröffentlichen';
  }
}

async function loadPackByCode() {
  const input  = document.getElementById('packCodeInput');
  const status = document.getElementById('loadCodeStatus');
  const code   = input.value.trim().toUpperCase();

  if (!code.match(/^MC-[A-Z0-9]{6}$/)) {
    status.style.color = 'var(--red)';
    status.textContent = '⚠ Format: MC-XXXXXX'; return;
  }
  status.style.color = 'var(--muted)';
  status.textContent = '⏳ Suche Pack...';

  try {
    const { data, error } = await sb.from('public_packs').select('*').eq('pack_code', code).single();
    if (error || !data) { status.style.color='var(--red)'; status.textContent='❌ Code nicht gefunden.'; return; }

    if (!applyPublicPackData(data)) {
      status.style.color = 'var(--red)';
      status.textContent = '⚠ Pack enthält keine gültigen Mods.';
      return;
    }
    document.getElementById('loadCodeOverlay').classList.remove('open');
    input.value = ''; status.textContent = '';
    showPage('builder');
    showToast('✅ "' + data.name + '" geladen – ' + MODS.length + ' Mods!');
  } catch(e) {
    status.style.color = 'var(--red)';
    status.textContent = '⚠ ' + e.message;
  }
}

function loadFromUrl() {
  try {
    const params = new URLSearchParams(location.search);
    const raw    = params.get('pack');
    if (!raw) return;
    const data = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (data.mods) MODS = data.mods.map(m => ({ slug: m.s, name: m.n, cat: m.c || 'Geteilt' }));
    if (data.rps)  RESOURCEPACKS = data.rps.map(r => ({ slug: r.s, name: r.n }));
    if (data.name) document.getElementById('packName').value = data.name;
    if (data.mc) {
      const sel = document.getElementById('mcVersion');
      if ([...sel.options].some(o => o.value === data.mc)) sel.value = data.mc;
    }
    renderMods(); renderRPs();
    // Clear URL so reload starts fresh
    history.replaceState(null, '', location.pathname);
    showToast('📦 Pack aus Link geladen!');
  } catch(e) {
    // ignore malformed pack params
  }
}

function selectPlatformAndBuild() {
  // If platform already selected, build directly
  if (selectedPlatform) {
    buildPack();
  } else {
    // Show platform overlay then build
    const po = document.getElementById('platformOverlay');
    if (po) {
      po.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
  }
}

/* ══ EXPORT AS TEXT LIST ═══════════════════════════════════════ */
function exportTextList() {
  if (!MODS.length && !RESOURCEPACKS.length) {
    showToast('⚠ Keine Mods im Pack!');
    return;
  }
  const mc   = document.getElementById('mcVersion').value;
  const name = document.getElementById('packName').value.trim() || 'Modpack';
  const lines = [
    name + ' – Minecraft ' + mc,
    '='.repeat(40),
    ''
  ];
  if (MODS.length) {
    const cats = [...new Set(MODS.map(m => m.cat))];
    cats.forEach(cat => {
      lines.push('[ ' + cat + ' ]');
      MODS.filter(m => m.cat === cat).forEach(m => lines.push('  • ' + m.name + '  (' + m.slug + ')'));
      lines.push('');
    });
  }
  if (RESOURCEPACKS.length) {
    lines.push('[ Texture Packs ]');
    RESOURCEPACKS.forEach(r => lines.push('  • ' + r.name + '  (' + r.slug + ')'));
    lines.push('');
  }
  lines.push('Erstellt mit MC Toolkit');
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = name.replace(/\s+/g,'_') + '-' + mc + '-mods.txt';
  document.body.appendChild(a); a.click(); a.remove();
  showToast('📄 Textliste exportiert!');
}

/* ══ KEYBOARD SHORTCUTS MODAL ══════════════════════════════════ */
function openShortcuts()  { document.getElementById('shortcutsModal').classList.add('open'); }
function closeShortcuts() { document.getElementById('shortcutsModal').classList.remove('open'); }

document.addEventListener('click', e => {
  if (e.target === document.getElementById('shortcutsModal')) closeShortcuts();
  if (e.target === document.getElementById('shareOverlay'))
    document.getElementById('shareOverlay').classList.remove('open');
});

/* ══ KEYBOARD SHORTCUTS HANDLER ════════════════════════════════ */
document.addEventListener('keydown', e => {
  const active = document.activeElement;
  const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');

  // Esc closes any modal
  if (e.key === 'Escape') {
    closeShortcuts();
    ['shareOverlay','imprintOverlay','privacyOverlay','feedbackOverlay','profilesOverlay','templatesOverlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
    });
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    switch(e.key.toLowerCase()) {
      case 's':
        e.preventDefault();
        openProfiles();
        break;
      case 'enter':
        if (!typing) { e.preventDefault(); buildPack(); }
        break;
      case 'f':
        e.preventDefault();
        const si = document.getElementById(
          document.getElementById('page-builder').classList.contains('active')
            ? 'packSearchInput' : 'searchInput'
        );
        if (si) { si.focus(); si.select(); }
        break;
      case 'z':
        if (!typing) { e.preventDefault(); doUndo(); }
        break;
      case 'e':
        if (!typing) { e.preventDefault(); exportTextList(); }
        break;
      case 'c':
        if (e.shiftKey && !typing) { e.preventDefault(); openShareModal(); }
        break;
    }
  }
});

/* ══ CONFETTI ══════════════════════════════════════════════════ */
function launchConfetti() {
  const colors = ['#4ade80','#60a5fa','#c084fc','#fb923c','#fbbf24','#f87171'];
  for (let i = 0; i < 80; i++) {
    const el   = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left     = Math.random() * 100 + 'vw';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.width    = (Math.random() * 8 + 6) + 'px';
    el.style.height   = (Math.random() * 8 + 6) + 'px';
    el.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
    el.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
    el.style.animationDelay    = (Math.random() * .8) + 's';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}


/* ══ PACK LOCK (after download) ════════════════════════════════ */
let packLocked = false;

function lockPack() {
  packLocked = true;
  renderMods(); renderRPs();
  // Grey out extra action buttons that modify the list
  const cat = document.querySelector('.cat-filters');
  if (cat) cat.style.pointerEvents = 'auto'; // filters still allowed
  // Show lock banner
  let banner = document.getElementById('packLockedBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'packLockedBanner';
    banner.style.cssText = 'background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);border-radius:9px;padding:.7rem 1rem;font-size:.78rem;color:#fcd34d;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:.8rem;';
    banner.innerHTML = '<span>🔒 Pack heruntergeladen – Liste gesperrt.</span><button onclick="unlockPack()" style="background:none;border:1px solid rgba(251,191,36,.4);border-radius:6px;color:#fcd34d;font-size:.72rem;font-weight:700;padding:3px 10px;cursor:pointer;font-family:var(--font)">Entsperren</button>';
    const listsWrap = document.querySelector('.lists-wrap');
    if (listsWrap) listsWrap.parentNode.insertBefore(banner, listsWrap);
  }
  banner.style.display = 'flex';
}

function unlockPack() {
  packLocked = false;
  const banner = document.getElementById('packLockedBanner');
  if (banner) banner.style.display = 'none';
  renderMods(); renderRPs();
  showToast('🔓 Liste entsperrt');
}


/* ══ AUTO-FIX ══════════════════════════════════════════════════ */
let autoFixIssues = [];

async function runAutoFix() {
  const btn       = document.getElementById('autoFixBtn');
  const panel     = document.getElementById('autoFixPanel');
  const title     = document.getElementById('autoFixTitle');
  const items     = document.getElementById('autoFixItems');
  const progress  = document.getElementById('autoFixProgress');
  const summary   = document.getElementById('autoFixSummary');
  const fixAllBtn = document.getElementById('autoFixAllBtn');

  btn.disabled = true;
  btn.textContent = '⏳ Analysiere...';
  panel.classList.add('open');
  items.innerHTML = '<div style="padding:.8rem 1rem;font-size:.78rem;color:var(--muted)">⏳ Prüfe alle Mods...</div>';
  summary.style.display = 'none';
  fixAllBtn.style.display = 'none';
  progress.style.width = '0%';
  title.className = '';
  title.textContent = 'Analysiere...';
  autoFixIssues = [];

  const mcV = document.getElementById('mcVersion').value;
  const all = [
    ...MODS.map(m => ({ ...m, isRP: false })),
    ...RESOURCEPACKS.map(r => ({ ...r, isRP: true }))
  ];

  // ── 1. Duplikate (sofort) ──────────────────────────────────────────────
  const slugsSeen = new Set();
  all.forEach(item => {
    if (slugsSeen.has(item.slug)) {
      autoFixIssues.push({ type: 'duplicate', item, severity: 'error', msg: 'Doppelter Eintrag – wird beim Export ignoriert' });
    }
    slugsSeen.add(item.slug);
  });

  // ── 2. Kompatibilität prüfen + Ersatz suchen ──────────────────────────
  for (let i = 0; i < all.length; i++) {
    const item = all[i];
    progress.style.width = Math.round((i / all.length) * 90) + '%';

    // Skip known duplicates
    if (autoFixIssues.find(iss => iss.item.slug === item.slug && iss.type === 'duplicate')) continue;

    await sleep(100);
    const ver = await fetchVersion(item.slug, mcV, item.isRP);

    if (!ver) {
      // Not found for this MC version – try to find a replacement via search
      let replacement = null;
      try {
        const searchType = item.isRP ? '&facets=[["project_type:resourcepack"]]' : '&facets=[["project_type:mod"],["categories:fabric"]]';
        const r = await fetch(
          'https://api.modrinth.com/v2/search?query=' + encodeURIComponent(item.name) +
          '&limit=5&game_versions=["' + mcV + '"]' + (item.isRP ? '' : '&loaders=["fabric"]'),
          { headers: { 'User-Agent': 'mctoolkit/1.0' } }
        );
        if (r.ok) {
          const data = await r.json();
          const hit  = (data.hits || []).find(h => h.slug !== item.slug);
          if (hit) replacement = { slug: hit.slug, name: hit.title, downloads: hit.downloads };
        }
      } catch(e) {}

      autoFixIssues.push({
        type: 'notfound', item, severity: 'error',
        msg: 'Nicht für MC ' + mcV + ' verfügbar',
        replacement
      });
    } else {
      autoFixIssues.push({
        type: 'ok', item, severity: 'ok',
        msg: 'v' + ver.version_number, ver
      });
    }
  }

  progress.style.width = '100%';

  // ── 3. Render ──────────────────────────────────────────────────────────
  items.innerHTML = '';
  const errors      = autoFixIssues.filter(i => i.severity === 'error');
  const oks         = autoFixIssues.filter(i => i.severity === 'ok');
  const replaceable = errors.filter(i => i.replacement);

  if (errors.length === 0) {
    title.className   = 'ok';
    title.textContent = '✅ Keine Fehler – Pack ist sauber!';
    items.innerHTML   = '<div style="padding:.8rem 1rem;font-size:.8rem;color:var(--green)">✅ Alle ' + oks.length + ' Mods sind kompatibel mit MC ' + mcV + '</div>';
  } else {
    title.className   = 'errors';
    title.textContent = '⚠ ' + errors.length + ' Fehler gefunden' + (replaceable.length ? ' · ' + replaceable.length + ' Ersatz verfügbar' : '');
    fixAllBtn.style.display = 'block';
    fixAllBtn.textContent   = '✓ Alle ' + errors.length + ' automatisch beheben';
  }

  autoFixIssues.forEach((issue, idx) => {
    if (issue.severity === 'ok') return;
    const el = document.createElement('div');
    el.className = 'autofix-item';
    el.id = 'afi-' + idx;

    let icon, actionHtml;

    if (issue.type === 'duplicate') {
      icon = '♊';
      actionHtml = '<button class="autofix-item-action remove" onclick="autoFixRemove(' + idx + ')">Entfernen</button>';
    } else if (issue.type === 'notfound' && issue.replacement) {
      icon = '🔄';
      actionHtml =
        '<button class="autofix-item-action fix" onclick="autoFixReplace(' + idx + ')" title="Ersetze durch: ' + esc(issue.replacement.name) + '">↑ Ersetzen</button>' +
        ' <button class="autofix-item-action remove" onclick="autoFixRemove(' + idx + ')">✕</button>';
    } else {
      icon = '❌';
      actionHtml = '<button class="autofix-item-action remove" onclick="autoFixRemove(' + idx + ')">Entfernen</button>';
    }

    const replacementHint = (issue.replacement)
      ? '<div style="font-size:.67rem;color:var(--blue);margin-top:2px">→ Ersatz: <b>' + esc(issue.replacement.name) + '</b> (' + esc(issue.replacement.slug) + ')</div>'
      : '';

    el.innerHTML =
      '<span class="autofix-item-icon">' + icon + '</span>' +
      '<span class="autofix-item-info">' +
        '<div class="autofix-item-name">' + esc(issue.item.name) + '</div>' +
        '<div class="autofix-item-desc">' + esc(issue.msg) + '</div>' +
        replacementHint +
      '</span>' +
      '<span style="display:flex;gap:4px;flex-shrink:0">' + actionHtml + '</span>';
    items.appendChild(el);
  });

  // ── 4. Summary ────────────────────────────────────────────────────────
  summary.style.display = 'flex';
  summary.innerHTML =
    '<span>Gesamt: <b>' + all.length + '</b></span>' +
    '<span style="color:var(--green)">✓ OK: <b>' + oks.length + '</b></span>' +
    (errors.length ? '<span style="color:var(--red)">✗ Fehler: <b>' + errors.length + '</b></span>' : '') +
    (replaceable.length ? '<span style="color:var(--blue)">🔄 Ersatz: <b>' + replaceable.length + '</b></span>' : '');

  btn.disabled    = false;
  btn.textContent = '🔧 Nochmals analysieren';
}

/* ── Auto-Fix actions ─────────────────────────────────────────── */
function autoFixRemove(idx) {
  const issue = autoFixIssues[idx];
  if (!issue) return;
  pushUndo();
  if (issue.item.isRP) RESOURCEPACKS = RESOURCEPACKS.filter(r => r.slug !== issue.item.slug);
  else MODS = MODS.filter(m => m.slug !== issue.item.slug);
  renderMods(); renderRPs();
  _markFixed(idx, '🗑 Entfernt');
  showToast('🗑 ' + issue.item.name + ' entfernt');
  _updateFixTitle();
}

function autoFixReplace(idx) {
  const issue = autoFixIssues[idx];
  if (!issue || !issue.replacement) return;
  pushUndo();
  const rep = issue.replacement;
  if (issue.item.isRP) {
    RESOURCEPACKS = RESOURCEPACKS.map(r =>
      r.slug === issue.item.slug ? { slug: rep.slug, name: rep.name } : r
    );
  } else {
    MODS = MODS.map(m =>
      m.slug === issue.item.slug ? { slug: rep.slug, name: rep.name, cat: m.cat } : m
    );
  }
  renderMods(); renderRPs();
  _markFixed(idx, '✅ Ersetzt durch ' + rep.name);
  showToast('🔄 ' + issue.item.name + ' → ' + rep.name);
  _updateFixTitle();
}

function _markFixed(idx, label) {
  const el = document.getElementById('afi-' + idx);
  if (!el) return;
  el.style.opacity = '.4';
  const actions = el.querySelector('span:last-child');
  if (actions) actions.innerHTML = '<span style="font-size:.7rem;color:var(--green)">' + esc(label) + '</span>';
  autoFixIssues[idx]._fixed = true;
}

function _updateFixTitle() {
  const remaining = autoFixIssues.filter(i => i.severity === 'error' && !i._fixed).length;
  const fixed     = autoFixIssues.filter(i => i._fixed).length;
  const title     = document.getElementById('autoFixTitle');
  const fixAllBtn = document.getElementById('autoFixAllBtn');
  const replaced  = autoFixIssues.filter(i => i._fixed && i.type === 'notfound' && i.replacement).length;
  const removed   = autoFixIssues.filter(i => i._fixed && (i.type === 'duplicate' || (i.type === 'notfound' && !i.replacement))).length;

  if (remaining === 0 && fixed > 0) {
    title.className   = 'ok';
    const parts = [];
    if (replaced) parts.push(replaced + ' Mod' + (replaced !== 1 ? 's' : '') + ' ersetzt');
    if (removed)  parts.push(removed  + ' entfernt');
    title.textContent = '✅ Alle Fehler behoben – ' + parts.join(', ');
    fixAllBtn.style.display = 'none';
  } else if (remaining > 0) {
    title.className   = 'errors';
    title.textContent = '⚠ Noch ' + remaining + ' Fehler offen';
  }
}

async function fixAll() {
  for (let i = 0; i < autoFixIssues.length; i++) {
    const issue = autoFixIssues[i];
    if (issue.severity !== 'error' || issue._fixed) continue;
    if (issue.replacement) {
      autoFixReplace(i);
    } else {
      autoFixRemove(i);
    }
    await sleep(80);
  }
  document.getElementById('autoFixAllBtn').style.display = 'none';
}


/* ══ BEST PVP PACK ═════════════════════════════════════════════ */
const BEST_PVP_PACK = {
  name: "Best PvP Pack",
  mc:   "1.21.11",
  mods: [
    // ── Performance ──
    { slug: "sodium",                  name: "Sodium",                  cat: "Performance" },
    { slug: "lithium",                 name: "Lithium",                 cat: "Performance" },
    { slug: "ferritecore",             name: "FerriteCore",             cat: "Performance" },
    { slug: "krypton",                 name: "Krypton",                 cat: "Performance" },
    { slug: "entityculling",           name: "EntityCulling",           cat: "Performance" },
    { slug: "dynamic-fps",             name: "Dynamic FPS",             cat: "Performance" },
    // ── Crystal PvP ──
    { slug: "clickcrystals",           name: "ClickCrystals",           cat: "PvP / Crystal" },
    { slug: "clientsidecrystals",      name: "Client Side Crystals",    cat: "PvP / Crystal" },
    { slug: "hcscr",                   name: "HCSCR",                   cat: "PvP / Crystal" },
    { slug: "totem-counter",           name: "Totem Counter",           cat: "PvP / Crystal" },
    // ── HUD ──
    { slug: "minihud",                 name: "MiniHUD",                 cat: "HUD" },
    { slug: "betterf3",                name: "BetterF3",                cat: "HUD" },
    { slug: "appleskin",               name: "AppleSkin",               cat: "HUD" },
    { slug: "shulkerboxtooltip",       name: "Shulker Box Tooltip",     cat: "HUD" },
    { slug: "inventoryhud",            name: "Inventory HUD+",          cat: "HUD" },
    // ── QoL ──
    { slug: "zoomify",                 name: "Zoomify",                 cat: "QoL" },
    { slug: "no-hurt-cam",             name: "No Hurt Cam",             cat: "QoL" },
    { slug: "mousetweaks",             name: "Mouse Tweaks",            cat: "QoL" },
    { slug: "gamma-utils",             name: "Gamma Utils",             cat: "QoL" },
    { slug: "reeses-sodium-options",   name: "Reese's Sodium Options",  cat: "QoL" },
    { slug: "remove-reloading-screen", name: "Remove Reloading Screen", cat: "QoL" },
  ]
};

function loadBestPvpPack() {
  pushUndo();
  MODS          = BEST_PVP_PACK.mods.map(m => ({ ...m }));
  RESOURCEPACKS = [];

  // Set MC version
  const sel = document.getElementById('mcVersion');
  if ([...sel.options].some(o => o.value === BEST_PVP_PACK.mc)) {
    sel.value = BEST_PVP_PACK.mc;
  }
  document.getElementById('packName').value = BEST_PVP_PACK.name;

  renderMods(); renderRPs();

  // Remove shared/locked banners
  ['sharedBanner','packLockedBanner'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  unlockPack && unlockPack();

  showToast('💎 Best PvP Pack geladen – ' + MODS.length + ' Mods für MC ' + BEST_PVP_PACK.mc + '!', 3000);
  document.getElementById('statusText').textContent =
    '✓ Best PvP Pack geladen – direkt generieren!';

  // Scroll to mod list
  setTimeout(() => {
    document.querySelector('.lists-wrap')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}


/* ══ BEST PVP PACK ══════════════════════════════════════════════ */


/* ══ PACK CONVERTER ════════════════════════════════════════════ */
let convPackData  = null;
let convDirection = null; // 'mr-to-cf' | 'cf-to-mr'

function selectConvertDir(dir) {
  convDirection = dir;
  document.querySelectorAll('.convert-dir-btn').forEach(b => b.classList.remove('active'));
  const idMap = {
    'mr-to-cf': 'cdirMRtoCF',
    'cf-to-mr': 'cdirCFtoMR',
    'lc-to-mr': 'cdirLCtoMR',
    'lc-to-cf': 'cdirLCtoCF'
  };
  const activeId = idMap[dir];
  if (activeId && document.getElementById(activeId)) {
    document.getElementById(activeId).classList.add('active');
  }
  const label = document.getElementById('convDZ-label');
  if (dir === 'mr-to-cf') {
    label.textContent = 'Modrinth .mrpack hier ablegen oder klicken';
  } else if (dir === 'cf-to-mr') {
    label.textContent = 'CurseForge .zip hier ablegen oder klicken';
  } else {
    label.textContent = 'Lunar Client Profile .json oder Mods .zip hier ablegen';
  }
  if (convPackData) previewConvert();
  updateConvBtn();
}

function dzDropConv(e) { e.preventDefault(); dzLeave('convDZ'); if(e.dataTransfer.files[0]) parseConvPack(e.dataTransfer.files[0]); }
function loadConvPack(inp) { if(inp.files[0]) parseConvPack(inp.files[0]); }

function clearConvDZ(e) {
  e.stopPropagation(); convPackData = null;
  document.getElementById('convDZ').classList.remove('loaded');
  document.getElementById('convDZ-icon').textContent = '📦';
  document.getElementById('convDZ-label').textContent = 'Pack hier ablegen oder klicken';
  ['convDZ-name','convDZ-stats'].forEach(id => document.getElementById(id).textContent = '');
  document.getElementById('convDZ-clear').style.display = 'none';
  document.getElementById('convFile').value = '';
  document.getElementById('convResult').style.display = 'none';
  document.getElementById('convStatus').textContent = '';
  updateConvBtn();
}

async function parseConvPack(file) {
  document.getElementById('convStatus').textContent = 'Lese ' + file.name + '...';
  try {
    let index = null;
    let packType = '';
    let zip = null;
    let modsList = [];
    let mcVersion = '1.21.11';

    if (file.name.endsWith('.json')) {
      const text = await file.text();
      const rawJson = JSON.parse(text);
      packType = 'lunar-json';
      index = rawJson;
      modsList = extractModsFromLunarJson(rawJson);
      if (rawJson.version || rawJson.mcVersion) {
        mcVersion = rawJson.version || rawJson.mcVersion;
      }
    } else {
      zip = await JSZip.loadAsync(file);
      const isMR  = !!zip.file('modrinth.index.json');
      const isCF  = !!zip.file('manifest.json');

      if (isMR) {
        index    = JSON.parse(await zip.file('modrinth.index.json').async('string'));
        packType = 'modrinth';
      } else if (isCF) {
        index    = JSON.parse(await zip.file('manifest.json').async('string'));
        packType = 'curseforge';
      } else {
        const jarFiles = Object.keys(zip.files).filter(k => k.endsWith('.jar') && !zip.files[k].dir);
        if (jarFiles.length > 0) {
          packType = 'lunar-zip';
          modsList = jarFiles.map(k => {
            const parts = k.split('/');
            return parts[parts.length - 1].replace(/\.jar$/, '');
          });
          index = { name: file.name.replace(/\.[^/.]+$/, ""), files: jarFiles };
        } else {
          throw new Error('Kein unterstütztes Modpack-Format (.mrpack, .zip, .json) gefunden.');
        }
      }
    }

    convPackData = { index, fileName: file.name, packType, zip, modsList, mcVersion };

    if (packType === 'modrinth') {
      selectConvertDir('mr-to-cf');
    } else if (packType === 'curseforge') {
      selectConvertDir('cf-to-mr');
    } else if (packType === 'lunar-json' || packType === 'lunar-zip') {
      if (convDirection !== 'lc-to-mr' && convDirection !== 'lc-to-cf') {
        selectConvertDir('lc-to-mr');
      } else {
        selectConvertDir(convDirection);
      }
    }

    const mc = packType === 'modrinth'
      ? (index.dependencies || {}).minecraft || '?'
      : packType === 'curseforge'
        ? (index.minecraft?.version || '?')
        : mcVersion;
    const name = index.name || file.name;
    const mods = packType === 'modrinth'
      ? index.files?.filter(f => f.path.startsWith('mods/')).length || 0
      : packType === 'curseforge'
        ? index.files?.length || 0
        : modsList.length;

    let typeLabel = 'Modrinth .mrpack';
    if (packType === 'curseforge') typeLabel = 'CurseForge .zip';
    if (packType === 'lunar-json') typeLabel = 'Lunar Client Profile .json';
    if (packType === 'lunar-zip') typeLabel = 'Lunar Client Mods .zip';

    document.getElementById('convDZ').classList.add('loaded');
    document.getElementById('convDZ-icon').textContent = '✅';
    document.getElementById('convDZ-label').textContent = '';
    document.getElementById('convDZ-name').textContent  = name;
    document.getElementById('convDZ-stats').textContent =
      mods + ' Mods • MC ' + mc + ' • ' + typeLabel;
    document.getElementById('convDZ-clear').style.display = 'block';
    document.getElementById('convStatus').textContent = '';
    previewConvert();
    updateConvBtn();
  } catch(e) {
    document.getElementById('convStatus').textContent = '⚠ ' + e.message;
  }
}

function previewConvert() {
  if (!convPackData) return;
  const { index, packType, modsList, mcVersion } = convPackData;
  const resultEl  = document.getElementById('convResult');
  const statsEl   = document.getElementById('convStats');
  const warnEl    = document.getElementById('convWarnings');
  resultEl.style.display = 'block';

  if (packType === 'modrinth') {
    const mods = index.files?.filter(f => f.path.startsWith('mods/')).length || 0;
    const rps  = index.files?.filter(f => f.path.startsWith('resourcepacks/')).length || 0;
    const mc   = (index.dependencies || {}).minecraft || '?';
    const fl   = (index.dependencies || {})['fabric-loader'] || '?';
    statsEl.innerHTML =
      cstat(mods,  'Mods',          'var(--green)') +
      (rps ? cstat(rps, 'Texture Packs', 'var(--purple)') : '') +
      cstat('MC ' + mc,  'Version',      'var(--blue)') +
      cstat('Fabric ' + fl, 'Loader',   'var(--muted)');
    warnEl.style.display = 'block';
    warnEl.innerHTML = '⚠ <b>Hinweis:</b> CurseForge benötigt eigene Mod-IDs. Da die Mods von Modrinth stammen, werden alle Download-Links in eine <code>modlist.html</code> im ZIP exportiert. Die Mods müssen einmalig manuell in den <code>mods/</code> Ordner gelegt werden.';
  } else if (packType === 'curseforge') {
    const mods = index.files?.length || 0;
    const mc   = index.minecraft?.version || '?';
    const ml   = index.minecraft?.modLoaders?.[0]?.id || '?';
    statsEl.innerHTML =
      cstat(mods, 'Mods (CF-IDs)',  'var(--orange)') +
      cstat('MC ' + mc, 'Version',  'var(--blue)') +
      cstat(ml, 'Loader',           'var(--muted)');
    warnEl.style.display = 'block';
    warnEl.innerHTML = '⚠ <b>Hinweis:</b> CurseForge Mod-IDs werden über die Modrinth API nach passenden Mods gesucht. Nicht alle Mods sind auf Modrinth verfügbar. Nicht gefundene Mods werden übersprungen.';
  } else {
    const modsCount = modsList ? modsList.length : 0;
    statsEl.innerHTML =
      cstat(modsCount, 'Lunar Mods', 'var(--blue)') +
      cstat('MC ' + mcVersion, 'Version', 'var(--blue)') +
      cstat('Fabric', 'Loader', 'var(--muted)');
    warnEl.style.display = 'block';
    if (convDirection === 'lc-to-mr') {
      warnEl.innerHTML = '💡 <b>Lunar Client zu Modrinth:</b> Wir suchen deine Lunar Client Mods über die Modrinth-Datenbank und erstellen eine fertige <code>.mrpack</code> Modpack-Datei für dich.';
    } else {
      warnEl.innerHTML = '💡 <b>Lunar Client zu CurseForge:</b> Wir suchen deine Lunar Client Mods und exportieren alle Download-Links in eine <code>modlist.html</code> in einem CurseForge-kompatiblen ZIP.';
    }
  }
}

function cstat(val, label, color) {
  return '<div class="convert-stat"><span class="csn" style="color:' + color + '">' + val + '</span><span style="font-size:.67rem;color:var(--muted)">' + label + '</span></div>';
}

function updateConvBtn() {
  const btn = document.getElementById('convBtn');
  if (!btn) return;
  btn.disabled = !convPackData || !convDirection;
}

async function runConvert() {
  if (!convPackData || !convDirection) return;
  const btn = document.getElementById('convBtn');
  const st  = document.getElementById('convStatus');
  const pb  = document.getElementById('convProgressBar');
  btn.disabled = true;
  document.getElementById('convProgressWrap').style.display = 'block';
  pb.style.width = '0%';

  if (convDirection === 'mr-to-cf') {
    await convertMRtoCF(btn, st, pb);
  } else if (convDirection === 'cf-to-mr') {
    await convertCFtoMR(btn, st, pb);
  } else if (convDirection === 'lc-to-mr') {
    await convertLCToMR(btn, st, pb);
  } else if (convDirection === 'lc-to-cf') {
    await convertLCToCF(btn, st, pb);
  }
}

/* ── Modrinth → CurseForge ───────────────────────────────────── */
async function convertMRtoCF(btn, st, pb) {
  const { index } = convPackData;
  const mc  = (index.dependencies || {}).minecraft || '1.21.11';
  const fl  = (index.dependencies || {})['fabric-loader'] || '0.18.3';
  const name = index.name || 'Converted Pack';

  const files     = index.files || [];
  const resolved  = [];
  const notFound  = [];

  for (let i = 0; i < files.length; i++) {
    const file  = files[i];
    const fname = file.path.split('/').pop();
    pb.style.width = Math.round((i / files.length) * 85) + '%';
    st.textContent = '(' + (i+1) + '/' + files.length + ') ' + fname;

    // Get project id from download URL
    let projectId = null;
    if (file.downloads?.[0]) {
      const m = file.downloads[0].match(/\/data\/([^\/]+)\//);
      if (m) projectId = m[1];
    }

    const url     = file.downloads?.[0] || '';
    const isRP    = file.path.startsWith('resourcepacks/');
    const ver     = projectId ? await fetchVersionById(projectId, mc, isRP) : null;
    const vf      = ver?.files?.find(x => x.primary) || ver?.files?.[0];

    resolved.push({
      name:     fname.replace(/\.jar$/, ''),
      filename: fname,
      url:      vf ? vf.url : url,
      version:  ver?.version_number || '?',
      isRP,
      found:    !!vf
    });
    if (!vf) notFound.push(fname);
    await sleep(100);
  }

  pb.style.width = '100%';
  st.textContent = 'Erstelle CurseForge .zip...';

  const manifest = {
    minecraft: { version: mc, modLoaders: [{ id: 'fabric-' + fl, primary: true }] },
    manifestType: 'minecraftModpack', manifestVersion: 1,
    name, version: index.versionId || '1.0.0', author: 'MC Toolkit',
    files: [], overrides: 'overrides'
  };

  const modRows = resolved.filter(m => !m.isRP).map(m =>
    '<li><a href="' + m.url + '">' + esc(m.name) + (m.version !== '?' ? ' (' + m.version + ')' : '') + '</a>' +
    (m.found ? '' : ' <span style="color:#f87171">[nicht auf Modrinth]</span>') + '</li>'
  ).join('\n');
  const rpRows = resolved.filter(m => m.isRP).map(m =>
    '<li><a href="' + m.url + '">' + esc(m.name) + '</a></li>'
  ).join('\n');

  const modlistHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(name) + '</title></head><body style="font-family:sans-serif;max-width:800px;margin:2rem auto;background:#1a1a2e;color:#f0f6fc"><h1 style="color:#4ade80">📦 ' + esc(name) + '</h1><p>MC ' + mc + ' · Fabric ' + fl + ' · ' + resolved.length + ' Dateien</p><h2>Mods</h2><ul>' + modRows + '</ul>' + (rpRows ? '<h2>Texture Packs</h2><ul>' + rpRows + '</ul>' : '') + '<hr><p style="color:#666">Konvertiert mit MC Toolkit</p></body></html>';
  const readme = name + '\nMC ' + mc + ' · Fabric ' + fl + '\nKonvertiert von .mrpack → CurseForge mit MC Toolkit\n\nMods manuell aus modlist.html herunterladen und in den mods/ Ordner legen.';

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('modlist.html', modlistHtml);
  zip.file('README.txt', readme);
  zip.folder('overrides').folder('mods');
  zip.folder('overrides').folder('resourcepacks');

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const fn   = name.replace(/\s+/g, '_') + '-curseforge.zip';
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = blobUrl; a.download = fn;
  document.body.appendChild(a); a.click(); a.remove();

  st.textContent = '✅ ' + resolved.length + ' Mods konvertiert' + (notFound.length ? ' · ' + notFound.length + ' nicht gefunden' : ' · Alle OK!') + ' → ' + fn;
  btn.disabled = false;
  launchConfetti();
  showOpenInApp(fn, 'curseforge', blobUrl);
}

/* ── CurseForge → Modrinth ───────────────────────────────────── */
async function convertCFtoMR(btn, st, pb) {
  const { index, zip: origZip } = convPackData;
  const mc   = index.minecraft?.version || '1.21.11';
  const ml   = index.minecraft?.modLoaders?.[0]?.id || 'fabric-0.18.3';
  const fl   = ml.replace(/^fabric-/, '');
  const name = index.name || 'Converted Pack';
  const cfFiles = index.files || [];

  const mrFiles      = []; // files with external download URLs (Modrinth or CF CDN)
  const overrideMods = {}; // files embedded directly in overrides/mods/
  const results      = []; // log per mod: {name, status, detail}

  // ── 1. Parse modlist.html → CF slug map ─────────────────────────────────
  const cfSlugMap = new Map(); // index → cfSlug
  const cfNameMap = new Map(); // index → display name
  if (origZip) {
    const mlFile = origZip.file('modlist.html');
    if (mlFile) {
      const html = await mlFile.async('string');
      const parser = new DOMParser();
      const doc    = parser.parseFromString(html, 'text/html');
      doc.querySelectorAll('li a[href]').forEach((a, i) => {
        const href = a.href || a.getAttribute('href') || '';
        const text = (a.textContent || '').replace(/\s*\(by .+?\)/, '').trim();
        const m    = href.match(/\/mc-mods\/([a-z0-9_-]+)/i);
        if (m) cfSlugMap.set(i, m[1]);
        if (text) cfNameMap.set(i, text);
      });
      st.textContent = 'modlist.html: ' + cfSlugMap.size + ' Mods erkannt';
    }
  }

  // ── 2. Also extract any existing override files ──────────────────────────
  if (origZip) {
    for (const key of Object.keys(origZip.files)) {
      if ((key.startsWith('overrides/mods/') || key.startsWith('overrides/resourcepacks/') || key.startsWith('overrides/config/')) && !origZip.files[key].dir) {
        overrideMods[key] = origZip.files[key];
      }
    }
  }

  // ── 3. Resolve each mod ──────────────────────────────────────────────────
  for (let i = 0; i < cfFiles.length; i++) {
    const cf       = cfFiles[i];
    const cfSlug   = cfSlugMap.get(i) || '';
    const modName  = cfNameMap.get(i) || cfSlug || ('Mod-' + cf.projectID);
    const fileId   = cf.fileID   || cf.fileid   || 0;
    const projId   = cf.projectID || cf.projectid || 0;
    const dlUrl    = cf.downloadUrl || '';

    pb.style.width = Math.round((i / Math.max(cfFiles.length,1)) * 85) + '%';
    st.textContent = '(' + (i+1) + '/' + cfFiles.length + ') ' + modName;
    await sleep(150);

    let found = false;

    // ── Strategy A: CF slug → Modrinth directly (most reliable) ───────────
    if (cfSlug && !found) {
      try {
        const ver = await fetchVersion(cfSlug, mc, false);
        if (ver) {
          const vf = ver.files.find(x => x.primary) || ver.files[0];
          if (vf) {
            mrFiles.push({ path: 'mods/' + vf.filename, hashes: vf.hashes, env: { client: 'required', server: 'unsupported' }, downloads: [vf.url], fileSize: vf.size });
            results.push({ name: modName, status: 'ok', detail: 'Modrinth: v' + ver.version_number });
            found = true;
          }
        }
      } catch(e) {}
    }

    // ── Strategy B: Name search on Modrinth ───────────────────────────────
    if (!found && modName && modName.length > 2) {
      try {
        const r = await fetch(
          'https://api.modrinth.com/v2/search?query=' + encodeURIComponent(modName) +
          '&limit=5&facets=%5B%5B%22project_type%3Amod%22%5D%5D',
          { headers: { 'User-Agent': 'mctoolkit/1.0' } }
        );
        if (r.ok) {
          const hits = (await r.json()).hits || [];
          for (const hit of hits) {
            // Fuzzy match: title or slug contains search term
            const ht  = hit.title.toLowerCase();
            const mn  = modName.toLowerCase();
            const match = ht === mn || ht.startsWith(mn) || mn.startsWith(ht) ||
                          hit.slug === cfSlug;
            if (!match) continue;
            const ver = await fetchVersion(hit.slug, mc, false);
            if (!ver) { // Try without MC filter
              const ver2 = await fetchVersion(hit.slug, '', false);
              if (!ver2) continue;
              const vf2 = ver2.files.find(x => x.primary) || ver2.files[0];
              if (!vf2) continue;
              mrFiles.push({ path: 'mods/' + vf2.filename, hashes: vf2.hashes, env: { client: 'required', server: 'unsupported' }, downloads: [vf2.url], fileSize: vf2.size });
              results.push({ name: modName, status: 'ok', detail: 'Modrinth (neueste): v' + ver2.version_number });
              found = true; break;
            }
            const vf = ver.files.find(x => x.primary) || ver.files[0];
            if (!vf) continue;
            mrFiles.push({ path: 'mods/' + vf.filename, hashes: vf.hashes, env: { client: 'required', server: 'unsupported' }, downloads: [vf.url], fileSize: vf.size });
            results.push({ name: modName, status: 'ok', detail: 'Modrinth v' + ver.version_number });
            found = true; break;
          }
        }
      } catch(e) {}
    }

    // ── Strategy C: Use downloadUrl from CF manifest directly ─────────────
    if (!found && dlUrl && dlUrl.startsWith('http')) {
      const fname = dlUrl.split('/').pop().split('?')[0] || (modName.replace(/\s+/g, '-') + '.jar');
      mrFiles.push({ path: 'mods/' + fname, hashes: {}, env: { client: 'required', server: 'unsupported' }, downloads: [dlUrl], fileSize: cf.fileSize || 0 });
      results.push({ name: modName, status: 'ok', detail: 'CF CDN direkt' });
      found = true;
    }

    // ── Strategy D: Construct CurseForge CDN URL from fileID ─────────────
    // CF CDN pattern: https://edge.forgecdn.net/files/{fileId/1000}/{fileId%1000}/{filename}
    // We don't know the filename, but we can try a common pattern
    if (!found && fileId > 0) {
      // Try to fetch the filename via a known CF API proxy
      try {
        // Use the CF metadata API (no key needed for basic lookup on some endpoints)
        const r = await fetch(
          'https://api.curseforge.com/v1/mods/' + projId + '/files/' + fileId,
          { headers: { 'x-api-key': '$2a$10$bL4bIL5pUWqfcO7KwjVm6OenKKEoikIdBRFcx5LHAOQoVBxKkNhKy' } }
        );
        if (r.ok) {
          const data = await r.json();
          const fname  = data.data?.fileName || '';
          const cdnUrl = data.data?.downloadUrl || ('https://edge.forgecdn.net/files/' + Math.floor(fileId/1000) + '/' + (fileId%1000) + '/' + fname);
          if (fname) {
            mrFiles.push({ path: 'mods/' + fname, hashes: {}, env: { client: 'required', server: 'unsupported' }, downloads: [cdnUrl], fileSize: data.data?.fileLength || 0 });
            results.push({ name: modName, status: 'ok', detail: 'CF CDN via API' });
            found = true;
          }
        }
      } catch(e) {}
    }

    if (!found) {
      results.push({ name: modName, status: 'fail', detail: 'Nicht gefunden – manuell hinzufügen' });
    }
  }

  pb.style.width = '100%';

  const okCount   = results.filter(r => r.status === 'ok').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  if (okCount === 0 && Object.keys(overrideMods).length === 0) {
    st.textContent = '⚠ Keine Mods gefunden. Das ZIP enthält keine verwertbaren Daten. Nutze eine CF-App-Export-ZIP (nicht die manuelle Downloadversion).';
    btn.disabled = false;
    return;
  }

  st.textContent = 'Erstelle .mrpack (' + okCount + '/' + cfFiles.length + ' Mods)...';

  const mrIndex = {
    formatVersion: 1, game: 'minecraft',
    versionId: index.version || '1.0.0',
    name, summary: 'Konvertiert von CurseForge mit MC Toolkit',
    files: mrFiles,
    dependencies: { minecraft: mc, 'fabric-loader': fl }
  };

  const newZip = new JSZip();
  newZip.file('modrinth.index.json', JSON.stringify(mrIndex, null, 2));
  const ov = newZip.folder('overrides');
  ov.folder('mods'); ov.folder('resourcepacks'); ov.folder('config');

  // Copy overrides from original CF zip
  for (const [key, file] of Object.entries(overrideMods)) {
    const nk = key.replace(/^overrides\//, '');
    ov.file(nk, await file.async('arraybuffer'));
  }

  // Build a results report
  if (failCount > 0) {
    const report = ['# Nicht konvertierte Mods\n\nDiese Mods wurden nicht gefunden und müssen manuell hinzugefügt werden:\n'];
    results.filter(r => r.status === 'fail').forEach(r => report.push('- ' + r.name));
    newZip.file('FEHLENDE_MODS.txt', report.join('\n'));
  }

  const blob    = await newZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const fn      = name.replace(/\s+/g, '_') + '-modrinth.mrpack';
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = blobUrl; a.download = fn;
  document.body.appendChild(a); a.click(); a.remove();

  const msg = '✅ ' + okCount + '/' + cfFiles.length + ' Mods' +
    (failCount ? ' · ⚠ ' + failCount + ' fehlen (→ FEHLENDE_MODS.txt im ZIP)' : ' · Alle gefunden! 🎉') +
    ' → ' + fn;
  st.textContent = msg;
  btn.disabled = false;
  if (okCount > 0) { launchConfetti(); showOpenInApp(fn, 'modrinth', blobUrl); }
}





function switchTut(id, btn) {
  document.querySelectorAll('.tut-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tut-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tut-' + id).classList.add('active');
  btn.classList.add('active');
}


/* ══ COOKIE BANNER ═════════════════════════════════════════════ */
function initCookieBanner() {
  const accepted = localStorage.getItem('mctoolkit_cookies');
  if (!accepted) {
    setTimeout(() => {
      document.getElementById('cookieBanner').style.display = 'flex';
    }, 1500);
  }
}
function acceptCookies() {
  localStorage.setItem('mctoolkit_cookies', 'accepted');
  hideCookieBanner();
}
function declineCookies() {
  localStorage.setItem('mctoolkit_cookies', 'declined');
  hideCookieBanner();
}
function hideCookieBanner() {
  const b = document.getElementById('cookieBanner');
  b.style.animation = 'none';
  b.style.transform = 'translateY(100%)';
  b.style.transition = 'transform .35s ease';
  setTimeout(() => b.style.display = 'none', 350);
}

/* ══ AGB MODAL ══════════════════════════════════════════════════ */
function openAgb() {
  document.getElementById('agbOverlay').classList.add('open');
}
document.addEventListener('click', e => {
  if (e.target === document.getElementById('agbOverlay'))
    document.getElementById('agbOverlay').classList.remove('open');
});



renderMods();renderRPs();
loadFromUrl();
initCookieBanner();

// Restore saved platform or show overlay
const _savedPlatform = localStorage.getItem('mctoolkit_platform');
if (_savedPlatform) {
  selectedPlatform = _savedPlatform;
  confirmPlatform();
} else {
  document.getElementById('platformOverlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

/* ══ AI SIDEBAR ══════════════════════════════════════════════════ */

let aiIsVip = false;
let aiLastModpackData = null;

// On mobile: collapse AI sidebar by default so it doesn't block the builder
(function initAiSidebarMobile() {
  if (window.innerWidth <= 768) {
    const lock = document.getElementById('aiLockScreen');
    const chat = document.getElementById('aiChatScreen');
    if (lock) lock.style.display = 'none';
    if (chat) chat.style.display = 'none';
  }
})();

const OWNER_EMAIL = 'justmotti@gmail.com';

function checkAndActivateOwner(email) {
  if (!email || email.toLowerCase() !== OWNER_EMAIL) return;
  aiIsVip = true;
  const lock  = document.getElementById('aiLockScreen');
  const chat  = document.getElementById('aiChatScreen');
  const badge = document.querySelector('.ai-vip-badge');
  const collapseBtn = document.getElementById('aiCollapseBtn');
  // Force show chat, hide lock — override any mobile collapsed state
  if (lock)  { lock.style.display = 'none'; }
  if (chat)  { chat.style.display = 'flex'; chat.classList.add('visible'); }
  if (badge) { badge.textContent = '👑 Owner'; badge.classList.add('owner'); }
  if (collapseBtn) collapseBtn.textContent = '▲ Bolt ausblenden';
  initBoltMcSelect();
  refreshApiKeyUI();
}

function refreshApiKeyUI() {
  const hasKey = !!localStorage.getItem('mctoolkit_groq_key');
  const rowEl = document.getElementById('aiApiKeyRow');
  const setEl = document.getElementById('aiApiKeySet');
  if (rowEl) rowEl.style.display = hasKey ? 'none' : 'flex';
  if (setEl) setEl.style.display = hasKey ? 'flex' : 'none';
}

function openVipModal() {
  document.getElementById('vipOverlay').classList.add('open');
}

function activateAiDemo() {
  aiIsVip = true;
  document.getElementById('aiLockScreen').style.display = 'none';
  document.getElementById('aiChatScreen').classList.add('visible');
  const badge = document.querySelector('.ai-vip-badge');
  badge.textContent = '🎮 Demo';
  badge.classList.remove('owner');
  badge.classList.add('demo');
  refreshApiKeyUI();
  initBoltMcSelect();
}

function toggleAiSidebar() {
  const chat = document.getElementById('aiChatScreen');
  const lock = document.getElementById('aiLockScreen');
  const btn  = document.getElementById('aiCollapseBtn');
  const isChatVisible = chat.classList.contains('visible');
  const isLockVisible = lock.style.display !== 'none';
  const isOpen = isChatVisible || isLockVisible;

  if (isOpen) {
    if (isChatVisible) chat.style.display = 'none';
    lock.style.display = 'none';
    btn.textContent = '▼ Bolt anzeigen';
  } else {
    if (isChatVisible) chat.style.display = '';
    else lock.style.display = '';
    btn.textContent = '▲ Bolt ausblenden';
  }
}

function aiInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); }
}

function autoResizeAiInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

/* ══ BOLT AI ════════════════════════════════════════════════════ */
const BOLT_NAME = 'Bolt';

const BOLT_PERF_CORE = ['sodium', 'lithium', 'entityculling', 'dynamic-fps', 'ferritecore', 'krypton', 'immediatelyfast', 'moreculling', 'modernfix', 'iris', 'indium', 'sodium-extra', 'reeses-sodium-options', 'fabric-api', 'fabric-language-kotlin', 'cloth-config', 'modmenu', 'placeholder-api', 'architectury'];

const BOLT_CLIENT_CHEAT = ['wurst', 'meteor-client', 'baritone', 'xray', 'x-ray', 'wi-freecam', 'freecam', 'aristois', 'impact', 'inertia', 'liquidbounce', 'sigma', 'bleachhack', 'future-client', 'phobos', 'kamiblue', 'rusherhack', 'gamesense', 'vape', 'entropy', 'novoline', 'meteor', 'forgehax'];

const BOLT_SERVER_RULES = {
  hypixel: {
    label: 'Hypixel',
    forbidden: ['wurst', 'meteor-client', 'baritone', 'xray', 'x-ray', 'wi-freecam', 'freecam', 'aristois', 'impact', 'inertia', 'liquidbounce', 'sigma', 'bleachhack', 'future-client', 'phobos', 'kamiblue', 'rusherhack', 'gamesense', 'vape', 'entropy', 'novoline'],
    risky: ['litematica', 'minihud', 'xaeros-world-map', 'journeymap', 'replaymod'],
    allowed: ['sodium', 'lithium', 'iris', 'ferritecore', 'entityculling', 'dynamic-fps', 'immediatelyfast', 'moreculling', 'krypton', 'badoptimizations', 'no-telemetry', 'appleskin', 'shulkerboxtooltip', 'modmenu', 'zoomify', 'yacl', 'fabric-api'],
    note: 'Hypixel erlaubt Performance/QoL-Mods. Keine Hacked-Clients, Freecam, X-Ray oder Baritone.'
  },
  donutsmp: {
    label: 'DonutSMP',
    forbidden: ['wurst', 'meteor-client', 'baritone', 'xray', 'x-ray', 'wi-freecam', 'freecam', 'aristois', 'impact', 'inertia', 'liquidbounce', 'sigma', 'bleachhack', 'future-client', 'phobos', 'kamiblue', 'rusherhack', 'gamesense', 'vape', 'entropy', 'novoline'],
    risky: ['litematica', 'minihud', 'schematica', 'replaymod', 'xaeros-world-map', 'journeymap'],
    allowed: ['sodium', 'lithium', 'iris', 'ferritecore', 'entityculling', 'dynamic-fps', 'immediatelyfast', 'moreculling', 'krypton', 'badoptimizations', 'fabric-api', 'modmenu', 'appleskin', 'shulkerboxtooltip', 'zoomify'],
    note: 'DonutSMP: Survival/SMP mit PvP. Performance/QoL ist sinnvoll, Cheat-Clients, X-Ray, Freecam und Baritone vermeiden.'
  },
  hugosmp: {
    label: 'HugoSMP',
    forbidden: ['wurst', 'meteor-client', 'baritone', 'xray', 'x-ray', 'wi-freecam', 'freecam', 'aristois', 'impact', 'inertia', 'liquidbounce', 'sigma', 'bleachhack'],
    risky: ['litematica', 'minihud', 'schematica', 'replaymod'],
    allowed: ['sodium', 'lithium', 'iris', 'ferritecore', 'entityculling', 'dynamic-fps', 'immediatelyfast', 'moreculling', 'krypton', 'fabric-api', 'modmenu', 'appleskin', 'jade', 'shulkerboxtooltip', 'zoomify'],
    note: 'HugoSMP: SMP/Content-Server. Nutze Performance, HUD und QoL; keine Hacked-Clients, X-Ray, Freecam oder Baritone.'
  },
  minemen: {
    label: 'Minemen Club',
    forbidden: ['wurst', 'meteor-client', 'baritone', 'xray', 'x-ray', 'wi-freecam', 'freecam', 'aristois', 'impact', 'inertia', 'liquidbounce', 'sigma', 'bleachhack', 'future-client', 'phobos', 'kamiblue', 'gamesense', 'vape', 'entropy', 'novoline'],
    risky: ['litematica', 'minihud', 'replaymod', 'xaeros-minimap', 'journeymap'],
    allowed: ['sodium', 'lithium', 'entityculling', 'dynamic-fps', 'immediatelyfast', 'moreculling', 'krypton', 'badoptimizations', 'fabric-api', 'modmenu', 'appleskin', 'zoomify'],
    note: 'Minemen Club: Practice/PvP. Bleib bei Performance, FPS, Ping und cleanem HUD. Keine Makros, Ghost/Hacked-Clients, Freecam oder X-Ray.'
  },
  pvplegacy: {
    label: 'PvP Legacy',
    forbidden: ['wurst', 'meteor-client', 'baritone', 'xray', 'x-ray', 'wi-freecam', 'freecam', 'aristois', 'impact', 'inertia', 'liquidbounce', 'sigma', 'bleachhack', 'vape'],
    risky: ['litematica', 'minihud', 'replaymod', 'xaeros-world-map'],
    allowed: ['sodium', 'lithium', 'entityculling', 'dynamic-fps', 'immediatelyfast', 'moreculling', 'krypton', 'fabric-api', 'modmenu', 'appleskin', 'zoomify'],
    note: 'PvP Legacy: PvP-Kit-Server. Performance und QoL sind passend; Cheat-Clients, Freecam und X-Ray vermeiden.'
  },
  mcpvp: {
    label: 'MCPvP Club',
    forbidden: ['wurst', 'meteor-client', 'baritone', 'xray', 'x-ray', 'wi-freecam', 'freecam', 'aristois', 'impact', 'inertia', 'liquidbounce', 'sigma', 'bleachhack', 'vape'],
    risky: ['litematica', 'minihud', 'replaymod'],
    allowed: ['sodium', 'lithium', 'entityculling', 'dynamic-fps', 'immediatelyfast', 'moreculling', 'krypton', 'fabric-api', 'modmenu', 'appleskin', 'zoomify'],
    note: 'MCPvP Club: PvP/Practice. Performance-Mods OK, alles mit unfairen Vorteilen vermeiden.'
  },
  crystal: {
    label: 'Crystal PvP / Anarchy',
    forbidden: ['wurst', 'meteor-client', 'baritone', 'xray', 'aristois', 'impact', 'liquidbounce'],
    risky: ['wi-freecam', 'freecam'],
    allowed: ['sodium', 'lithium', 'iris', 'marlow-crystal-optimizer', 'clickcrystals', 'pvpoptimizer', 'totem-counter', 'appleskin', 'fabric-api', 'modmenu'],
    note: 'Crystal-Server: Performance & Crystal-Mods OK. Keine Cheat-Clients.'
  },
  smp: {
    label: 'Privater SMP',
    forbidden: ['wurst', 'meteor-client', 'xray', 'aristois', 'impact', 'liquidbounce', 'sigma'],
    risky: [],
    allowed: ['sodium', 'lithium', 'iris', 'ferritecore', 'jei', 'roughly-enough-items', 'waystones', 'journeymap', 'xaeros-minimap', 'appleskin', 'jade', 'fabric-api'],
    note: 'Private SMPs sind oft lockerer – Cheat-Clients trotzdem vermeiden.'
  }
};


const BOLT_SERVERS_KEY = 'mctoolkit_bolt_servers_v1';
const BOLT_DEFAULT_SERVERS = [
  { id:'hypixel', name:'Hypixel', desc:'Mini-Games, BedWars, SkyWars', ruleKey:'hypixel', icon:'H' },
  { id:'donutsmp', name:'DonutSMP', desc:'Survival SMP, PvP, Hardcore', ruleKey:'donutsmp', icon:'D' },
  { id:'hugosmp', name:'HugoSMP', desc:'SMP, Creator, Survival', ruleKey:'hugosmp', icon:'H' },
  { id:'minemen', name:'Minemen Club', desc:'Practice PvP, ranked, clean client', ruleKey:'minemen', icon:'M' },
  { id:'pvplegacy', name:'PvP Legacy', desc:'Kit PvP, 1.9+ combat', ruleKey:'pvplegacy', icon:'P' },
  { id:'mcpvp', name:'MCPvP Club', desc:'Practice and PvP', ruleKey:'mcpvp', icon:'M' },
  { id:'crystal', name:'Crystal PvP', desc:'Anarchy, crystals, performance', ruleKey:'crystal', icon:'C' },
  { id:'smp', name:'Privater SMP', desc:'Survival, QoL, relaxed rules', ruleKey:'smp', icon:'S' }
];
let boltServers = [];
function cloneBoltDefaults() { return JSON.parse(JSON.stringify(BOLT_DEFAULT_SERVERS)); }
function loadBoltServers() { try { const saved = JSON.parse(localStorage.getItem(BOLT_SERVERS_KEY) || 'null'); boltServers = Array.isArray(saved) && saved.length ? saved : cloneBoltDefaults(); } catch (_) { boltServers = cloneBoltDefaults(); } }
function saveBoltServers() { localStorage.setItem(BOLT_SERVERS_KEY, JSON.stringify(boltServers)); }
function getActiveBoltServerId() { return document.getElementById('boltServerSelect')?.value || boltServers[0]?.id || 'hypixel'; }
function getBoltServerById(id) { return boltServers.find(s => s.id === id) || boltServers[0] || BOLT_DEFAULT_SERVERS[0]; }
function getBoltServerRule(key) { const server = getBoltServerById(key); return BOLT_SERVER_RULES[server?.ruleKey || key] || BOLT_SERVER_RULES.smp; }
function renderBoltServerList() {
  if (!boltServers.length) loadBoltServers();
  const list = document.getElementById('boltServerList');
  if (!list) return;
  const active = getActiveBoltServerId();
  list.innerHTML = boltServers.map(server => {
    const selected = server.id === active ? ' selected' : '';
    const custom = server.custom ? '<span class="mc-server-custom">custom</span>' : '';
    return '<button type="button" class="mc-server-row'+selected+'" onclick="selectBoltServer(\''+esc(server.id)+'\')" ondblclick="editBoltServer(\''+esc(server.id)+'\')">'
      + '<span class="mc-server-icon">'+esc(server.icon || server.name.charAt(0) || '?')+'</span>'
      + '<span class="mc-server-main"><b>'+esc(server.name)+'</b><small>'+esc(server.desc || '')+'</small></span>'
      + custom + '<span class="mc-server-bars">|||</span></button>';
  }).join('');
}
function selectBoltServer(key) { if (!boltServers.length) loadBoltServers(); const server = getBoltServerById(key); const input = document.getElementById('boltServerSelect'); const label = document.getElementById('boltServerLabel'); if (input) input.value = server.id; if (label) label.textContent = server.name; renderBoltServerList(); }
function addBoltCustomServer() { if (!boltServers.length) loadBoltServers(); const name = prompt('Server Name'); if (!name) return; const desc = prompt('Beschreibung / Spielmodus', 'Eigener Server') || 'Eigener Server'; const ruleKey = prompt('Regel-Typ: hypixel, donutsmp, hugosmp, minemen, crystal oder smp', 'smp') || 'smp'; const id = 'custom-' + Date.now().toString(36); boltServers.push({ id, name:name.trim(), desc:desc.trim(), ruleKey:BOLT_SERVER_RULES[ruleKey] ? ruleKey : 'smp', icon:name.trim().charAt(0).toUpperCase(), custom:true }); saveBoltServers(); selectBoltServer(id); }
function editBoltServer(id) { const server = getBoltServerById(id); if (!server) return; const name = prompt('Server Name', server.name); if (!name) return; const desc = prompt('Beschreibung / Spielmodus', server.desc || '') || server.desc || ''; const ruleKey = prompt('Regel-Typ: hypixel, donutsmp, hugosmp, minemen, crystal oder smp', server.ruleKey || 'smp') || server.ruleKey || 'smp'; server.name = name.trim(); server.desc = desc.trim(); server.ruleKey = BOLT_SERVER_RULES[ruleKey] ? ruleKey : 'smp'; server.icon = server.name.charAt(0).toUpperCase(); server.custom = server.custom || !BOLT_DEFAULT_SERVERS.some(s => s.id === id); saveBoltServers(); selectBoltServer(id); }
function moveBoltServer(dir) { const active = getActiveBoltServerId(); const idx = boltServers.findIndex(s => s.id === active); const next = idx + dir; if (idx < 0 || next < 0 || next >= boltServers.length) return; [boltServers[idx], boltServers[next]] = [boltServers[next], boltServers[idx]]; saveBoltServers(); renderBoltServerList(); }
function deleteBoltServer() { const active = getActiveBoltServerId(); const server = getBoltServerById(active); if (!server || !confirm('Server "' + server.name + '" entfernen?')) return; boltServers = boltServers.filter(s => s.id !== active); if (!boltServers.length) boltServers = cloneBoltDefaults(); saveBoltServers(); selectBoltServer(boltServers[0].id); }
function resetBoltServers() { if (!confirm('Serverliste auf Standard zuruecksetzen?')) return; boltServers = cloneBoltDefaults(); saveBoltServers(); selectBoltServer('hypixel'); }

function initBoltMcSelect() {
  const src = document.getElementById('mcVersion');
  const tgt = document.getElementById('boltTargetMc');
  if (!src || !tgt) return;
  if (!tgt.options.length) {
    loadBoltServers();
    renderBoltServerList();
    [...src.options].forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.textContent;
      tgt.appendChild(opt);
    });
  }
  const cur = src.value;
  const different = [...tgt.options].find(o => o.value !== cur);
  if (different) tgt.value = different.value;
}

function boltEnsureChatVisible() {
  const lock = document.getElementById('aiLockScreen');
  const chat = document.getElementById('aiChatScreen');
  if (lock) lock.style.display = 'none';
  if (chat) { chat.classList.add('visible'); chat.style.display = 'flex'; }
}

function boltRequireAccess() {
  if (!aiIsVip) {
    showToast('⭐ Bolt ist ein VIP-Feature');
    openVipModal();
    return false;
  }
  if (!localStorage.getItem('mctoolkit_groq_key')) {
    appendAiMsg('bot', '⚠ Trage zuerst deinen Groq API-Key oben ein.');
    return false;
  }
  return true;
}

function boltGetPackContext() {
  const mc = document.getElementById('mcVersion')?.value || '1.21.1';
  const name = document.getElementById('packName')?.value?.trim() || 'Mein Modpack';
  const slugs = MODS.map(m => m.slug);
  const names = MODS.map(m => m.name + ' (' + m.slug + ')').join(', ');
  return { mc, name, slugs, names, count: slugs.length };
}

function boltFormatHtml(text) {
  return (text || '')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

async function boltCallGroq(systemPrompt, userPrompt, maxTokens = 1200) {
  const apiKey = localStorage.getItem('mctoolkit_groq_key');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message || 'Groq API Fehler');
  return data.choices?.[0]?.message?.content || '';
}

function boltParseApplyBlock(raw) {
  const m = raw.match(/<BOLT_APPLY>([\s\S]*?)<\/BOLT_APPLY>/i);
  if (!m) return { add: [], remove: [], explain: [] };
  const block = m[1];
  const addM = block.match(/add:\s*(.+)/i);
  const remM = block.match(/remove:\s*(.+)/i);
  const expM = block.match(/explain:\s*([\s\S]*?)(?=\n\w+:|$)/i);
  const parseList = s => (s || '').split(/[,;\n]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
  const explain = expM ? expM[1].trim().split(/\n-\s*/).filter(Boolean) : [];
  return {
    add: parseList(addM ? addM[1] : ''),
    remove: parseList(remM ? remM[1] : ''),
    explain
  };
}

async function boltApplySlugs(addSlugs, removeSlugs) {
  const added = [], removed = [], failed = [];
  pushUndo();
  if (removeSlugs.length) {
    const remSet = new Set(removeSlugs);
    removed.push(...MODS.filter(m => remSet.has(m.slug)).map(m => m.slug));
    MODS = MODS.filter(m => !remSet.has(m.slug));
    if (removed.length) renderMods();
  }
  for (const slug of addSlugs) {
    if (has(slug, 'mod')) continue;
    const res = await detectAndResolve(slug);
    if (res && addResolved(res, 'Bolt')) added.push(res.name || slug);
    else failed.push(slug);
  }
  updateBuildBtn();
  return { added, removed, failed };
}

function boltLocalDuplicates() {
  const seen = new Set();
  const dups = [];
  MODS.forEach(m => {
    if (seen.has(m.slug)) dups.push(m.slug);
    seen.add(m.slug);
  });
  return [...new Set(dups)];
}

function boltLocalServerHits(serverKey) {
  const rules = getBoltServerRule(serverKey);
  const slugs = MODS.map(m => m.slug);
  const forbidden = slugs.filter(s => rules.forbidden.some(f => s.includes(f) || f.includes(s)));
  const risky = slugs.filter(s => rules.risky.some(r => s.includes(r) || r.includes(s)) && !forbidden.includes(s));
  return { rules, forbidden, risky };
}

function boltLocalMissingPerf() {
  const slugs = new Set(MODS.map(m => m.slug));
  return BOLT_PERF_CORE.filter(s => !slugs.has(s));
}

function boltLocalClientCheats() {
  const hits = [];
  MODS.forEach(m => {
    if (BOLT_CLIENT_CHEAT.some(c => m.slug.includes(c) || c.includes(m.slug))) hits.push(m.slug);
  });
  return [...new Set(hits)];
}

function boltRemoveDuplicatesLocal() {
  const dups = boltLocalDuplicates();
  if (!dups.length) return [];
  pushUndo();
  const seen = new Set();
  MODS = MODS.filter(m => { if (seen.has(m.slug)) return false; seen.add(m.slug); return true; });
  renderMods();
  return dups;
}

function boltApplyVersionReplacements(issues) {
  const replaced = [];
  pushUndo();
  for (const issue of issues) {
    if (!issue.replacement) continue;
    const idx = MODS.findIndex(m => m.slug === issue.slug);
    if (idx === -1) continue;
    MODS[idx] = { slug: issue.replacement.slug, name: issue.replacement.name, cat: MODS[idx].cat || 'Bolt' };
    replaced.push({ from: issue.slug, to: issue.replacement.slug, name: issue.replacement.name });
  }
  if (replaced.length) renderMods();
  return replaced;
}

async function boltCollectVersionIssues(targetMc) {
  const issues = [];
  for (const m of MODS) {
    const ver = await fetchVersion(m.slug, targetMc, false);
    if (!ver) {
      let replacement = null;
      try {
        const r = await fetch(
          'https://api.modrinth.com/v2/search?query=' + encodeURIComponent(m.name) +
          '&limit=5&game_versions=["' + targetMc + '"]&loaders=["fabric"]',
          { headers: { 'User-Agent': 'mctoolkit/1.0' } }
        );
        if (r.ok) {
          const hit = (await r.json()).hits?.find(h => h.slug !== m.slug);
          if (hit) replacement = { slug: hit.slug, name: hit.title };
        }
      } catch (_) {}
      issues.push({ slug: m.slug, name: m.name, replacement });
    }
    await sleep(60);
  }
  return issues;
}

async function boltRunWithUi(label, fn) {
  if (!boltRequireAccess()) return;
  boltEnsureChatVisible();
  document.getElementById('aiSendBtn').disabled = true;
  appendAiMsg('user', '⚡ ' + label);
  appendTyping();
  try {
    const html = await fn();
    removeTyping();
    appendAiMsg('bot', html);
  } catch (e) {
    removeTyping();
    appendAiMsg('bot', '⚠ ' + e.message);
  }
  document.getElementById('aiSendBtn').disabled = false;
}

const BOLT_SYSTEM = `Du bist Bolt ⚡, der Minecraft Fabric Modpack-Experte von MC Toolkit.
Antworte IMMER auf Deutsch. Sei präzise, freundlich, nutze Bullet-Points mit "- ".
Wenn du konkrete Pack-Änderungen empfiehlst, füge am Ende ein:
<BOLT_APPLY>
add: slug1, slug2
remove: slug3
explain:
- Kurze Erklärung pro Änderung
</BOLT_APPLY>
Nur echte Modrinth-Fabric-Slugs. Keine erfundenen Mods.`;

async function boltPackOptimize() {
  await boltRunWithUi('Pack optimieren', async () => {
    const ctx = boltGetPackContext();
    if (!ctx.count) return '⚠ Dein Pack ist leer — füge zuerst Mods im Builder hinzu.';

    const missingPerf = boltLocalMissingPerf();
    const clientCheats = boltLocalClientCheats();

    let html = '<b>⚡ Bolt – Pack-Optimierung</b><br><br>';

    const dupsRemoved = boltRemoveDuplicatesLocal();
    if (dupsRemoved.length) html += '🗑 <b>Duplikate entfernt:</b> ' + dupsRemoved.join(', ') + '<br>';

    if (clientCheats.length) {
      const result = await boltApplySlugs([], clientCheats);
      html += '🚫 <b>Client-only / Cheat-Mods entfernt:</b> ' + result.removed.join(', ') + '<br>';
      html += '<span style="font-size:.72rem;color:var(--muted)">Diese Mods sind reine Client-Cheats oder auf Servern riskant.</span><br>';
    }

    const userPrompt = `Analysiere dieses Fabric-Modpack für MC ${ctx.mc}:
Name: ${ctx.name}
Mods (${MODS.length}): ${MODS.map(m => m.slug).join(', ')}

Aufgaben:
1) Fehlende Performance-Basis ergänzen (z.B. ${missingPerf.slice(0, 6).join(', ') || 'sodium, lithium'})
2) Überflüssige/redundante Mods entfernen (nicht Performance-Core!)
3) Kurz begründen – pro Änderung eine Zeile in explain:
Performance-Core NIEMALS entfernen: sodium, lithium, fabric-api, iris, indium`;

    const raw = await boltCallGroq(BOLT_SYSTEM, userPrompt, 1100);
    const display = raw.replace(/<BOLT_APPLY>[\s\S]*?<\/BOLT_APPLY>/gi, '').trim();
    html += boltFormatHtml(display);

    const { add, remove, explain } = boltParseApplyBlock(raw);
    if (add.length || remove.length) {
      const result = await boltApplySlugs(add, remove);
      html += '<br><br>✅ <b>Angewendet:</b>';
      if (result.added.length) html += '<br>+ ' + result.added.join(', ');
      if (result.removed.length) html += '<br>− ' + result.removed.join(', ');
      if (result.failed.length) html += '<br>⚠ Nicht gefunden: ' + result.failed.join(', ');
      if (explain.length) html += '<br><br>' + explain.map(e => '• ' + esc(e)).join('<br>');
    }
    return html;
  });
}

async function boltAutoFixExplain() {
  await boltRunWithUi('Auto-Fix mit Erklärung', async () => {
    const ctx = boltGetPackContext();
    if (!ctx.count) return '⚠ Keine Mods zum Prüfen.';

    const mcV = ctx.mc;
    const issues = [];
    const explanations = [];

    const dupsRemoved = boltRemoveDuplicatesLocal();
    if (dupsRemoved.length) {
      issues.push({ type: 'duplicate', slug: '-', name: 'Duplikate', msg: 'Entfernt: ' + dupsRemoved.join(', ') });
      explanations.push('Doppelte Slugs wurden automatisch entfernt, damit der Export sauber bleibt.');
    }

    const depsAdded = [];
    for (const m of [...MODS]) {
      for (const dep of (DEP_MAP[m.slug] || [])) {
        if (!has(dep, 'mod')) {
          const res = await detectAndResolve(dep);
          if (res && addResolved(res, 'Bolt-Dep')) depsAdded.push((res.name || dep) + ' (für ' + m.name + ')');
        }
      }
    }
    if (depsAdded.length) {
      renderMods();
      issues.push({ type: 'dep', slug: '-', name: 'Dependencies', msg: 'Ergänzt: ' + depsAdded.join(', ') });
      explanations.push('Fehlende Abhängigkeiten wurden ergänzt: ' + depsAdded.join(', '));
    }

    const versionIssues = [];
    for (let i = 0; i < MODS.length; i++) {
      const m = MODS[i];
      const ver = await fetchVersion(m.slug, mcV, false);
      if (!ver) {
        let replacement = null;
        try {
          const r = await fetch('https://api.modrinth.com/v2/search?query=' + encodeURIComponent(m.name) + '&limit=5&game_versions=["' + mcV + '"]&loaders=["fabric"]', { headers: { 'User-Agent': 'mctoolkit/1.0' } });
          if (r.ok) {
            const hit = (await r.json()).hits?.find(h => h.slug !== m.slug);
            if (hit) replacement = { slug: hit.slug, name: hit.title };
          }
        } catch (_) {}
        versionIssues.push({ slug: m.slug, name: m.name, replacement });
        issues.push({
          type: 'version', slug: m.slug, name: m.name,
          msg: 'Nicht für MC ' + mcV,
          replacement: replacement ? replacement.slug + ' (' + replacement.name + ')' : null
        });
      }
      await sleep(70);
    }

    const autoReplaced = boltApplyVersionReplacements(versionIssues);
    if (autoReplaced.length) {
      issues.push({ type: 'replaced', slug: '-', name: 'Ersatz-Mods', msg: autoReplaced.map(r => r.from + ' → ' + r.to).join(', ') });
      explanations.push('Inkompatible Mods wurden durch Modrinth-Ersatz ersetzt.');
    }

    let html = '<b>🔧 Bolt – Auto-Fix mit Erklärung</b><br><br>';
    if (explanations.length) {
      html += '<b>Was Bolt gemacht hat:</b><ul style="margin:.35rem 0 .6rem;padding-left:1.1rem">';
      explanations.forEach(e => { html += '<li>' + esc(e) + '</li>'; });
      html += '</ul>';
    }
    if (issues.length) {
      html += '<b>Gefundene Punkte:</b><ul style="margin:.35rem 0;padding-left:1.1rem">';
      issues.forEach(i => {
        html += '<li><b>' + esc(i.name) + '</b>: ' + esc(i.msg);
        if (i.replacement && typeof i.replacement === 'string') html += ' → <code>' + esc(i.replacement) + '</code>';
        else if (i.replacement?.slug) html += ' → <code>' + esc(i.replacement.slug) + '</code>';
        html += '</li>';
      });
      html += '</ul>';
    } else {
      html += '✅ Keine kritischen Probleme gefunden.<br>';
    }

    const issueText = issues.map(i => {
      let line = `- [${i.type}] ${i.name} (${i.slug}): ${i.msg}`;
      if (i.replacement?.slug) line += ' → Ersatz: ' + i.replacement.slug;
      else if (typeof i.replacement === 'string') line += ' → Ersatz: ' + i.replacement;
      return line;
    }).join('\n');

    const raw = await boltCallGroq(
      BOLT_SYSTEM,
      `Erkläre dem Nutzer auf Deutsch – freundlich und konkret – was die folgenden Auto-Fix-Ergebnisse bedeuten und was er noch tun kann:\n${issueText || 'Keine Fehler — Pack sieht gut aus.'}\n\nBereits automatisch erledigt:\n${explanations.join('\n') || 'nichts'}\n\nPack: ${ctx.name}, MC ${mcV}`,
      1000
    );
    html += '<br>' + boltFormatHtml(raw.replace(/<BOLT_APPLY>[\s\S]*?<\/BOLT_APPLY>/gi, '').trim());

    const { add, remove, explain } = boltParseApplyBlock(raw);
    if (add.length || remove.length) {
      const result = await boltApplySlugs(add, remove);
      html += '<br><br>✅ <b>Zusätzlich angewendet:</b>';
      if (result.added.length) html += '<br>+ ' + result.added.join(', ');
      if (result.removed.length) html += '<br>− ' + result.removed.join(', ');
      if (explain.length) html += '<br>' + explain.map(e => '• ' + esc(e)).join('<br>');
    }

    html += '<br><br><button class="bolt-inline-btn" onclick="runAutoFix();showPage(\'builder\')">🔧 Detail-Auto-Fix im Builder</button>';
    return html;
  });
}

async function boltServerCheck() {
  await boltRunWithUi('Server-Check', async () => {
    const ctx = boltGetPackContext();
    if (!ctx.count) return '⚠ Keine Mods im Pack.';

    const serverKey = document.getElementById('boltServerSelect')?.value || 'hypixel';
    const activeServer = getBoltServerById(serverKey);
    const hit = boltLocalServerHits(serverKey);
    const rules = { ...hit.rules, label: activeServer?.name || hit.rules.label };
    const { forbidden, risky } = hit;

    let html = '<b>🛡 Bolt – Server-Check: ' + esc(rules.label) + '</b><br>';
    html += '<span style="font-size:.75rem;color:var(--muted)">' + esc(rules.note) + '</span><br><br>';

    if (forbidden.length) {
      html += '❌ <b>Stark riskant / oft verboten:</b><br><code>' + forbidden.join('</code>, <code>') + '</code><br><br>';
    }
    if (risky.length) {
      html += '⚠ <b>Vorsicht (Server-abhängig):</b><br><code>' + risky.join('</code>, <code>') + '</code><br><br>';
    }
    if (!forbidden.length && !risky.length) {
      html += '✅ Keine bekannten High-Risk-Mods in deiner Liste.<br><br>';
    }

    const raw = await boltCallGroq(
      BOLT_SYSTEM,
      `Server-Check: ${rules.label}
Regel: ${rules.note}
Erlaubte Mods (Beispiele): ${(rules.allowed || []).join(', ')}
Pack-Mods: ${MODS.map(m => m.slug).join(', ')}

Lokal verboten (werden entfernt): ${forbidden.join(', ') || 'keine'}
Lokal riskant: ${risky.join(', ') || 'keine'}

Aufgabe:
1) Erkläre was problematisch ist
2) Für JEDEN entfernten Mod eine ERLAUBTE Alternative nennen (Modrinth slug) – z.B. statt Freecam: Zoomify
3) Fehlende erlaubte Performance-Mods vorschlagen (add:)
4) BOLT_APPLY mit remove + add + explain`,
      1100
    );
    html += boltFormatHtml(raw.replace(/<BOLT_APPLY>[\s\S]*?<\/BOLT_APPLY>/gi, '').trim());

    const { add, remove, explain } = boltParseApplyBlock(raw);
    const autoRemove = [...new Set([...forbidden, ...remove])];
    if (autoRemove.length || add.length) {
      const result = await boltApplySlugs(add, autoRemove);
      html += '<br><br>✅ <b>Änderungen:</b>';
      if (result.removed.length) html += '<br>Entfernt: ' + result.removed.join(', ');
      if (result.added.length) html += '<br>Hinzugefügt: ' + result.added.join(', ');
      if (explain.length) html += '<br>' + explain.map(e => '• ' + esc(e)).join('<br>');
    }
    return html;
  });
}

async function boltVersionUpdate() {
  await boltRunWithUi('MC-Versions-Update', async () => {
    const ctx = boltGetPackContext();
    if (!ctx.count) return '⚠ Keine Mods zum Prüfen.';

    const targetMc = document.getElementById('boltTargetMc')?.value || ctx.mc;
    if (targetMc === ctx.mc) {
      return 'ℹ️ Zielversion ist bereits <b>' + esc(targetMc) + '</b>. Wähle eine andere Version im Dropdown.';
    }

    let html = '<b>⬆ Bolt – Update auf MC ' + esc(targetMc) + '</b><br>';
    html += 'Aktuell: <b>' + esc(ctx.mc) + '</b> → Ziel: <b>' + esc(targetMc) + '</b><br>';
    html += '<span style="font-size:.72rem;color:var(--muted)">Prüfe alle ' + ctx.count + ' Mods auf Modrinth…</span><br><br>';

    const issues = await boltCollectVersionIssues(targetMc);
    const withReplacement = issues.filter(i => i.replacement);
    const withoutReplacement = issues.filter(i => !i.replacement);

    if (!issues.length) {
      html += '✅ Alle Mods haben eine Version für <b>' + esc(targetMc) + '</b>!<br>';
      document.getElementById('mcVersion').value = targetMc;
      html += '<br>📌 MC-Version im Builder auf <b>' + esc(targetMc) + '</b> gesetzt.';
      return html;
    }

    const autoReplaced = boltApplyVersionReplacements(withReplacement);
    if (autoReplaced.length) {
      html += '✅ <b>Automatisch ersetzt (' + autoReplaced.length + '):</b><ul style="margin:.35rem 0;padding-left:1.1rem">';
      autoReplaced.forEach(r => {
        html += '<li><code>' + esc(r.from) + '</code> → <code>' + esc(r.to) + '</code> (' + esc(r.name) + ')</li>';
      });
      html += '</ul>';
    }

    if (withoutReplacement.length) {
      html += '⚠ <b>Ohne Ersatz auf ' + esc(targetMc) + ':</b><ul style="margin:.35rem 0;padding-left:1.1rem">';
      withoutReplacement.forEach(i => {
        html += '<li><b>' + esc(i.name) + '</b> (<code>' + esc(i.slug) + '</code>)</li>';
      });
      html += '</ul>';
    }

    const issueLines = issues.map(i =>
      `- ${i.name} (${i.slug})${i.replacement ? ' → Ersatz: ' + i.replacement.slug + ' (' + i.replacement.name + ')' : ' → kein Ersatz, ggf. entfernen'}`
    ).join('\n');

    const raw = await boltCallGroq(
      BOLT_SYSTEM,
      `MC-Versions-Update: ${ctx.mc} → ${targetMc}
Pack: ${ctx.name}

Bereits automatisch ersetzt: ${autoReplaced.map(r => r.from + ' → ' + r.to).join(', ') || 'keine'}

Probleme:\n${issueLines}

Erkläre auf Deutsch was noch zu tun ist. Für Mods ohne Ersatz: remove in BOLT_APPLY. Für bessere Alternativen: remove + add.`,
      1100
    );
    html += '<br>' + boltFormatHtml(raw.replace(/<BOLT_APPLY>[\s\S]*?<\/BOLT_APPLY>/gi, '').trim());

    const { remove, add, explain } = boltParseApplyBlock(raw);
    if (remove.length || add.length) {
      const result = await boltApplySlugs(add, remove);
      html += '<br><br>✅ <b>Weitere Anpassungen:</b>';
      if (result.added.length) html += '<br>+ ' + result.added.join(', ');
      if (result.removed.length) html += '<br>− ' + result.removed.join(', ');
      if (explain.length) html += '<br>' + explain.map(e => '• ' + esc(e)).join('<br>');
    }

    document.getElementById('mcVersion').value = targetMc;
    html += '<br><br>📌 MC-Version im Builder auf <b>' + esc(targetMc) + '</b> gesetzt.';
    return html;
  });
}

const AI_PRESETS = {
  crystalpvp: {
    name: 'SMP Crystal PvP Pack',
    version: '1.21.1',
    slugs: [
      'anchoroptimizer', 'appleskin', 'architectury', 'bactromod',
      'better-ping-display', 'betterhurtcam', 'bettershieldsounds', 'betterstats',
      'cape-provider', 'chunky-fabric', 'clickcrystals', 'cloth-config',
      'crosshairaddons', 'cullleaves', 'dynamic-fps', 'entityculling',
      'exordium', 'fabric-api', 'fabric-language-kotlin', 'fastexp',
      'fastquit', 'gamma-utils', 'herosanchoroptimizer', 'holo-damage-indicator',
      'hologram-api', 'hotbar-keys', 'hotbar-presets', 'immediatelyfast',
      'inventoryhud', 'jade', 'joinautosprintmod', 'justzoom',
      'konkrete', 'krypton', 'libipn', 'litematica',
      'lithium', 'malilib', 'marlow-crystal-optimizer', 'midnightlib',
      'modmenu', 'moreculling', 'mousetweaks', 'myresourcepack',
      'no-resource-pack-warnings', 'no-death-animation', 'no-fog',
      'packetfixer', 'placeholder-api', 'potioncounter', 'ptp',
      'pvpoptimizer', 'reeses-sodium-options', 'reflex', 'remove-warden-effect',
      'remove-reloading-screen', 'screenshotmetadata', 'searchables', 'secondchat',
      'serverpingerfixer', 'shield-status', 'shulkerboxtooltip', 'simpleresourceloader',
      'smooth-boot', 'smoothjoin', 'snappy-tappy', 'sodium',
      'sodium-extra', 'sound-controller', 'sprint-after-death', 'status-effect-bars',
      'totem-counter', 'ukulib', 'simple-voice-chat', 'voxy',
      'wi-freecam', 'xaeros-minimap', 'xaeros-world-map', 'yacl'
    ]
  },
  performance: {
    name: 'Pure Performance',
    version: '1.21.1',
    slugs: ['sodium','lithium','ferritecore','krypton','entityculling','dynamic-fps','chunky','sodium-extra','reeses-sodium-options','remove-reloading-screen']
  },
  survival: {
    name: 'Vanilla+',
    version: '1.21.1',
    slugs: ['sodium','lithium','ferritecore','dynamic-fps','appleskin','shulkerboxtooltip','mousetweaks','zoomify','inventoryhud','betterf3','remove-reloading-screen','gamma-utils']
  },
  hypixel: {
    name: 'Vollständiger Pack',
    version: '1.21.1',
    slugs: ['sodium','lithium','ferritecore','krypton','entityculling','dynamic-fps','chunky','clickcrystals','clientsidecrystals','hcscr','totem-counter','minihud','appleskin','betterf3','shulkerboxtooltip','inventoryhud','zoomify','mousetweaks','no-hurt-cam','remove-reloading-screen','reeses-sodium-options','gamma-utils']
  }
};

function aiLoadPreset(key) {
  const preset = AI_PRESETS[key];
  if (!preset) return;
  aiLastModpackData = preset;
  appendAiMsg('bot', `🧩 <b>${preset.name}</b> bereit! <br><code>${preset.slugs.length} Mods</code> – klick auf "In Builder laden"!`);
  document.getElementById('aiApplyStrip').classList.add('visible');
}

// Hero mini-template loader — scrolls to app, picks platform if needed, loads preset
function heroLoadPreset(key) {
  const preset = AI_PRESETS[key];
  if (!preset) return;

  const doLoad = () => {
    // Set pack name + version
    const nameEl = document.getElementById('packName');
    if (nameEl) nameEl.value = preset.name;
    const verEl = document.getElementById('mcVersion');
    if (verEl) {
      for (const opt of verEl.options) {
        if (opt.value === preset.version || opt.value.startsWith(preset.version)) { verEl.value = opt.value; break; }
      }
    }
    // Load slugs via paste area
    const pasteEl = document.getElementById('pasteArea');
    if (pasteEl) { pasteEl.value = preset.slugs.join('\n'); addFromPaste(); }
    showPage('builder');
    document.getElementById('app').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('🧩 ' + preset.name + ' wird geladen...');
  };

  // If platform not chosen yet, show overlay first then load
  if (!selectedPlatform) {
    document.getElementById('platformOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    // After confirm, load the preset
    const origConfirm = window._pendingPresetLoad;
    window._pendingPresetLoad = doLoad;
  } else {
    doLoad();
  }
}

function aiQuickPrompt(text) {
  document.getElementById('aiInput').value = text;
  sendAiMessage();
}

function appendAiMsg(role, html) {
  const box = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = 'ai-msg ' + role;
  div.innerHTML = `
    <div class="ai-msg-avatar"><span>${role === 'bot' ? '⚡' : 'Du'}</span></div>
    <div class="ai-msg-bubble">${html}</div>
  `;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function appendTyping() {
  const box = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = 'ai-msg bot';
  div.id = 'aiTypingIndicator';
  div.innerHTML = `<div class="ai-msg-avatar"><span>⚡</span></div><div class="ai-msg-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('aiTypingIndicator');
  if (t) t.remove();
}

async function sendAiMessage() {
  const inp = document.getElementById('aiInput');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = ''; inp.style.height = 'auto';
  document.getElementById('aiSendBtn').disabled = true;
  appendAiMsg('user', text);
  appendTyping();

  const systemPrompt = `Du bist Bolt ⚡, der Minecraft Fabric Modpack-Experte von MC Toolkit. Wenn der Nutzer einen Server oder Spielstil beschreibt, erstelle eine optimale Modliste.

WICHTIG: Antworte IMMER auf Deutsch. Sei freundlich und kompetent.

Wenn du eine Modliste erstellst, formatiere sie IMMER so am Ende deiner Antwort (damit sie automatisch geladen werden kann):
<MODPACK>
name: [Modpack Name]
mods: sodium, lithium, iris, [weitere mods durch Komma getrennt]
version: 1.21.1
</MODPACK>

Nutze nur echte, bekannte Fabric-Mods von Modrinth. Empfehle immer sodium+lithium als Performance-Basis.
Für PvP: sodium, lithium, iris, badoptimizations, moreculling, entityculling, nvidium, clickcrystals, crystalvault, minihud, xaeros-minimap
Für Survival/QoL: sodium, lithium, iris, roughly-enough-items, waystones, jei, appleskin, jade, xaeros-minimap
Für Performance: sodium, lithium, iris, featherlight, nvidium, moreculling, entityculling, lazydfu`;

  const apiKey = localStorage.getItem('mctoolkit_groq_key');
  if (!apiKey) {
    removeTyping();
    appendAiMsg('bot', '⚠ Kein API-Key gesetzt. Bitte trage deinen kostenlosen Groq API-Key oben ein.');
    document.getElementById('aiSendBtn').disabled = false;
    return;
  }

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      })
    });
    const data = await resp.json();
    removeTyping();

    if (data.error) {
      appendAiMsg('bot', '⚠ API Fehler: ' + (data.error.message || 'Prüfe deinen Groq API-Key.'));
      document.getElementById('aiSendBtn').disabled = false;
      return;
    }

    const raw = data.choices?.[0]?.message?.content || 'Fehler beim Antworten.';

    // Parse modpack block
    const modpackMatch = raw.match(/<MODPACK>([\s\S]*?)<\/MODPACK>/);
    let displayHtml = raw.replace(/<MODPACK>[\s\S]*?<\/MODPACK>/g, '').trim();
    displayHtml = displayHtml
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');

    appendAiMsg('bot', displayHtml);

    if (modpackMatch) {
      const block = modpackMatch[1];
      const nameM  = block.match(/name:\s*(.+)/);
      const modsM  = block.match(/mods:\s*(.+)/);
      const verM   = block.match(/version:\s*(.+)/);
      aiLastModpackData = {
        name:    nameM  ? nameM[1].trim()  : 'Bolt Modpack',
        mods:    modsM  ? modsM[1].trim()  : '',
        version: verM   ? verM[1].trim()   : '1.21.1'
      };
      document.getElementById('aiApplyStrip').classList.add('visible');
    }
  } catch(e) {
    removeTyping();
    appendAiMsg('bot', '⚠ Verbindungsfehler: ' + e.message);
  }
  document.getElementById('aiSendBtn').disabled = false;
}

function saveAiApiKey() {
  const val = document.getElementById('aiApiKeyInput').value.trim();
  if (!val) { showToast('⚠ Bitte einen API-Key eingeben'); return; }
  localStorage.setItem('mctoolkit_groq_key', val);
  document.getElementById('aiApiKeyInput').value = '';
  document.getElementById('aiApiKeyRow').style.display = 'none';
  document.getElementById('aiApiKeySet').style.display = 'flex';
  showToast('✅ Groq API-Key gespeichert!');
}

function clearAiApiKey() {
  localStorage.removeItem('mctoolkit_groq_key');
  document.getElementById('aiApiKeyRow').style.display = 'flex';
  document.getElementById('aiApiKeySet').style.display = 'none';
}

function applyAiModpack() {
  if (!aiLastModpackData) return;

  // Set pack name
  const nameEl = document.getElementById('packName');
  if (nameEl) nameEl.value = aiLastModpackData.name;

  // Set MC version
  const verEl = document.getElementById('mcVersion');
  if (verEl && aiLastModpackData.version) {
    for (const opt of verEl.options) {
      if (opt.value === aiLastModpackData.version || opt.value.startsWith(aiLastModpackData.version)) {
        verEl.value = opt.value; break;
      }
    }
  }

  // Switch to builder tab first
  showPage('builder');

  // Load via slugs (same as template system) OR via paste area for AI-generated packs
  if (aiLastModpackData.slugs) {
    // Use the paste area with slugs — exact same flow as manual templates
    const pasteEl = document.getElementById('pasteArea');
    if (pasteEl) {
      pasteEl.value = aiLastModpackData.slugs.join('\n');
      addFromPaste();
    }
  } else if (aiLastModpackData.mods) {
    const pasteEl = document.getElementById('pasteArea');
    if (pasteEl) {
      pasteEl.value = aiLastModpackData.mods;
      addFromPaste();
    }
  }

  // Flash confirmation
  const strip = document.getElementById('aiApplyStrip');
  strip.innerHTML = '<span>✅ In Builder geladen!</span>';
  setTimeout(() => {
    strip.classList.remove('visible');
    strip.innerHTML = '<span>🧩 Modpack bereit</span><button class="ai-apply-btn" onclick="applyAiModpack()">In Builder laden ↗</button>';
  }, 2500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBoltMcSelect);
} else {
  initBoltMcSelect();
}
undefined

/* MODRINTH ACCOUNT BACKEND INTEGRATION */
let modrinthUser = null;
let modrinthProjects = [];
let selectedModrinthProjectId = null;
function startModrinthLogin() { location.href = '/api/modrinth/auth'; }
function openModrinthPanel() { closeAuth?.(); document.getElementById('modrinthOverlay')?.classList.add('open'); document.body.style.overflow = 'hidden'; refreshModrinthPanel(); loadModrinthSession().catch(() => {}); }
function closeModrinthPanel() { document.getElementById('modrinthOverlay')?.classList.remove('open'); document.body.style.overflow = ''; }
function setModrinthMessage(text, type='') { const el = document.getElementById('modrinthMsg'); if (!el) return; el.className = 'auth-msg ' + (type || ''); el.textContent = text || ''; }
async function modrinthApi(path, options={}) { const res = await fetch('/api/modrinth/' + path, Object.assign({ credentials:'include' }, options)); if (!res.ok) { let msg = res.status + ' ' + res.statusText; try { const data = await res.json(); msg = data.error || data.message || msg; } catch(_) {} throw new Error(msg); } return res.json(); }
function refreshModrinthPanel() { const nameEl = document.getElementById('modrinthUserName'); const metaEl = document.getElementById('modrinthUserMeta'); if (!nameEl || !metaEl) return; if (modrinthUser) { nameEl.textContent = modrinthUser.username || 'Modrinth'; metaEl.textContent = (modrinthProjects.length || 0) + ' Modpacks gefunden'; } else { nameEl.textContent = 'Nicht verbunden'; metaEl.textContent = 'Melde dich mit Modrinth an, um deine Modpacks zu sehen.'; } }
async function loadModrinthSession() { try { modrinthUser = await modrinthApi('me'); refreshModrinthPanel(); if (!modrinthProjects.length) await loadModrinthProjects(); } catch(e) { modrinthUser = null; refreshModrinthPanel(); setModrinthMessage('Noch nicht mit Modrinth verbunden.'); } }
async function disconnectModrinth() { await fetch('/api/modrinth/logout', { method:'POST', credentials:'include' }).catch(() => {}); modrinthUser = null; modrinthProjects = []; selectedModrinthProjectId = null; document.getElementById('modrinthProjects').innerHTML = '<div class="empty-profiles">Noch keine Modrinth-Modpacks geladen.</div>'; setModrinthMessage('Modrinth getrennt.'); refreshModrinthPanel(); }
async function loadModrinthProjects() { const box = document.getElementById('modrinthProjects'); try { setModrinthMessage('Lade Modrinth-Modpacks...'); const data = await modrinthApi('projects'); modrinthUser = data.user; modrinthProjects = data.projects || []; renderModrinthProjects(); setModrinthMessage(modrinthProjects.length ? modrinthProjects.length + ' Modpack-Projekte geladen.' : 'Keine Web-Modpacks gefunden. Modrinth-App Packs bitte als .mrpack importieren.', modrinthProjects.length ? 'ok' : ''); } catch(e) { if (box) box.innerHTML = '<div class="empty-profiles">' + escapeHtml(e.message) + '</div>'; setModrinthMessage(e.message, 'err'); } refreshModrinthPanel(); }
function renderModrinthProjects() { const box = document.getElementById('modrinthProjects'); if (!box) return; if (!modrinthProjects.length) { box.innerHTML = '<div class="empty-profiles">Keine eigenen Modrinth-Modpacks gefunden.</div>'; return; } box.innerHTML = modrinthProjects.map(p => { const icon = p.icon_url ? '<img src="'+escapeHtml(p.icon_url)+'" alt="">' : '<span>'+escapeHtml((p.title||'?').charAt(0).toUpperCase())+'</span>'; const active = selectedModrinthProjectId === p.id ? ' selected' : ''; return '<div class="modrinth-project'+active+'" onclick="selectModrinthProject(\''+p.id+'\')"><div class="modrinth-project-icon">'+icon+'</div><div class="modrinth-project-main"><b>'+escapeHtml(p.title||p.slug)+'</b><span>'+escapeHtml(p.slug||p.id)+' - '+escapeHtml(p.status||'')+'</span></div><div class="modrinth-project-actions"><button onclick="event.stopPropagation();loadModrinthProjectPack(\''+p.id+'\')">Laden</button><button onclick="event.stopPropagation();window.open(\'https://modrinth.com/modpack/'+escapeHtml(p.slug||p.id)+'\',\'_blank\')">Oeffnen</button></div></div>'; }).join(''); }
function selectModrinthProject(id) { selectedModrinthProjectId = id; renderModrinthProjects(); const p = modrinthProjects.find(x => x.id === id); if (p) setModrinthMessage('Ziel gewaehlt: ' + p.title, 'ok'); }
async function loadModrinthProjectPack(projectId) { try { if (String(projectId).startsWith('local:') || String(projectId).startsWith('local-drop:') || String(projectId).startsWith('local-json:')) { return loadLocalModrinthInstance(modrinthProjects.find(p => p.id === projectId)); } setModrinthMessage('Lade neueste .mrpack-Version...'); const data = await modrinthApi('pack?projectId=' + encodeURIComponent(projectId)); importModrinthIndexToBuilder(data.index); setModrinthMessage('Pack geladen: ' + (data.index.name || data.version?.name || 'Modpack'), 'ok'); closeModrinthPanel(); showToast('Modrinth-Pack in Builder geladen'); } catch(e) { setModrinthMessage(e.message, 'err'); } }




async function handleModrinthProfileDrop(event) {
  event.preventDefault();
  document.getElementById('modrinthProfileDropzone')?.classList.remove('drag');
  try {
    const entries = Array.from(event.dataTransfer?.items || [])
      .map(item => item.webkitGetAsEntry?.())
      .filter(Boolean);
    if (!entries.length) throw new Error('Bitte den profiles-Ordner oder Pack-Ordner aus dem Explorer hier hineinziehen.');
    setModrinthMessage('Lese lokale Modrinth-App Packs...');
    const profiles = [];
    for (const entry of entries) {
      if (!entry.isDirectory) continue;
      const found = await profilesFromDroppedEntry(entry);
      profiles.push(...found);
    }
    modrinthProjects = dedupeLocalProfiles(profiles);
    selectedModrinthProjectId = null;
    renderModrinthProjects();
    setModrinthMessage(modrinthProjects.length ? modrinthProjects.length + ' lokale Packs geladen.' : 'Keine Pack-Ordner mit mods/ gefunden.', modrinthProjects.length ? 'ok' : '');
    refreshModrinthPanel();
  } catch(e) {
    setModrinthMessage(e.message || 'Ordner konnte nicht gelesen werden.', 'err');
  }
}
async function profilesFromDroppedEntry(entry) {
  if (await directoryHasUsableMods(entry)) return [await localProfileFromEntry(entry)];
  const children = await readDirectoryEntries(entry);
  const profiles = [];
  for (const child of children) {
    if (child.isDirectory && await directoryHasUsableMods(child)) profiles.push(await localProfileFromEntry(child));
  }
  return profiles;
}
async function localProfileFromEntry(profileEntry) {
  const mods = await readDroppedFolderFiles(profileEntry, 'mods', ['.jar']);
  const rps = await readDroppedFolderFiles(profileEntry, 'resourcepacks', ['.zip', '.jar']);
  return {
    id: 'local-drop:' + profileEntry.fullPath,
    title: profileEntry.name.replace(/_/g, ' '),
    slug: 'local-drop',
    status: 'Modrinth App - ' + mods.length + ' Mods' + (rps.length ? ' / ' + rps.length + ' Packs' : ''),
    project_type: 'modpack',
    local_app: true,
    local_mods: mods,
    local_rps: rps,
    game_version: guessMcVersionFromName(profileEntry.name)
  };
}
async function readDroppedFolderFiles(profileEntry, folderName, extensions) {
  const children = await readDirectoryEntries(profileEntry);
  const folder = children.find(e => e.isDirectory && e.name.toLowerCase() === folderName.toLowerCase());
  if (!folder) return [];
  const files = await readDirectoryEntries(folder);
  return files
    .filter(e => e.isFile && extensions.some(ext => e.name.toLowerCase().endsWith(ext)))
    .map(e => ({ filename:e.name, name:cleanLocalModName(e.name), slug:slugifyLocalProject(e.name) }))
    .sort((a,b) => a.name.localeCompare(b.name));
}
async function directoryHasChild(entry, childName) {
  const children = await readDirectoryEntries(entry);
  return children.some(e => e.isDirectory && e.name.toLowerCase() === childName.toLowerCase());
}
async function directoryHasUsableMods(entry) {
  const mods = await readDroppedFolderFiles(entry, 'mods', ['.jar']);
  return mods.length > 0;
}
function readDirectoryEntries(entry) {
  return new Promise((resolve, reject) => {
    const reader = entry.createReader();
    const out = [];
    const readBatch = () => reader.readEntries(batch => {
      if (!batch.length) return resolve(out);
      out.push(...batch);
      readBatch();
    }, reject);
    readBatch();
  });
}
function dedupeLocalProfiles(profiles) {
  const seen = new Set();
  return profiles.filter(p => {
    const key = p.id || p.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function importModrinthProfilesJson(input) {
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const profiles = Array.isArray(data) ? data : (data.profiles || []);
    modrinthProjects = profiles.map((p, i) => ({
      id: p.id || ('local-json:' + i),
      title: p.title || p.name || ('Pack ' + (i + 1)),
      slug: p.slug || 'local-json',
      status: p.status || ('Modrinth App - ' + (p.local_mods?.length || p.mods?.length || 0) + ' Mods'),
      project_type: 'modpack',
      local_app: true,
      local_mods: p.local_mods || p.mods || [],
      local_rps: p.local_rps || p.resourcepacks || [],
      game_version: p.game_version || p.minecraft || ''
    }));
    selectedModrinthProjectId = null;
    renderModrinthProjects();
    setModrinthMessage(modrinthProjects.length + ' lokale Modrinth-App Packs importiert.', 'ok');
    refreshModrinthPanel();
  } catch(e) {
    setModrinthMessage(e.message || 'Profil-Liste konnte nicht importiert werden.', 'err');
  } finally {
    if (input) input.value = '';
  }
}

async function scanModrinthAppProfiles() {
  if (!window.showDirectoryPicker) {
    setModrinthMessage('Dein Browser unterstuetzt Ordner-Auswahl nicht. Nutze Chrome/Edge oder .mrpack importieren.', 'err');
    return;
  }
  try {
    setModrinthMessage('Waehle den Ordner AppData/Roaming/ModrinthApp/profiles aus.');
    const dir = await window.showDirectoryPicker({ mode: 'read' });
    const profiles = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'directory') continue;
      const mods = await readModrinthLocalFiles(handle, 'mods', ['.jar']);
      const rps = await readModrinthLocalFiles(handle, 'resourcepacks', ['.zip', '.jar']);
      if (mods.length < 1) continue;
      profiles.push({
        id: 'local:' + name,
        title: name.replace(/_/g, ' '),
        slug: 'local-app',
        status: mods.length + ' Mods' + (rps.length ? ' / ' + rps.length + ' Packs' : ''),
        project_type: 'modpack',
        local_app: true,
        local_mods: mods,
        local_rps: rps,
        game_version: guessMcVersionFromName(name)
      });
    }
    modrinthProjects = profiles;
    selectedModrinthProjectId = null;
    renderModrinthProjects();
    setModrinthMessage(profiles.length ? profiles.length + ' lokale Modrinth-App Packs gefunden.' : 'Keine lokalen Packs im ausgewaehlten Ordner gefunden.', profiles.length ? 'ok' : '');
    refreshModrinthPanel();
  } catch(e) {
    if (e && e.name === 'AbortError') return;
    setModrinthMessage(e.message || 'Ordner konnte nicht gelesen werden.', 'err');
  }
}
async function readModrinthLocalFiles(profileHandle, folderName, extensions) {
  try {
    const folder = await profileHandle.getDirectoryHandle(folderName);
    const files = [];
    for await (const [name, handle] of folder.entries()) {
      if (handle.kind !== 'file') continue;
      const lower = name.toLowerCase();
      if (!extensions.some(ext => lower.endsWith(ext))) continue;
      files.push({ filename: name, name: cleanLocalModName(name), slug: slugifyLocalProject(name) });
    }
    return files.sort((a,b) => a.name.localeCompare(b.name));
  } catch (_) {
    return [];
  }
}
function loadLocalModrinthInstance(profile) {
  if (!profile) return;
  document.getElementById('packName').value = profile.title || 'Modrinth App Pack';
  if (profile.game_version) document.getElementById('mcVersion').value = profile.game_version;
  MODS = (profile.local_mods || []).map(m => ({ slug:m.slug, name:m.name, cat:'Imported' }));
  RESOURCEPACKS = (profile.local_rps || []).map(r => ({ slug:r.slug, name:r.name, cat:'Imported' }));
  renderMods();
  renderRPs();
  if (typeof updateCounters === 'function') updateCounters();
  closeModrinthPanel();
  showToast('Lokales Modrinth-Pack geladen');
}
function guessMcVersionFromName(name) {
  const match = String(name).match(/(?:^|[^0-9])(1.d+(?:.d+)?)(?:[^0-9]|$)/);
  return match ? match[1] : '';
}
function cleanLocalModName(filename) {
  return String(filename)
    .replace(/.(jar|zip)$/i, '')
    .replace(/[-_]?d+(?:.d+)+(?:[+-][a-z0-9_.-]+)?/ig, '')
    .replace(/[-_]+/g, ' ')
    .replace(/s+/g, ' ')
    .trim() || filename;
}
function slugifyLocalProject(filename) {
  return cleanLocalModName(filename).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'local-project';
}

async function importLocalMrpackToBuilder(input) {
  const file = input?.files?.[0];
  if (!file) return;
  try {
    setModrinthMessage('Importiere ' + file.name + '...');
    const zip = await JSZip.loadAsync(file);
    const idxFile = zip.file('modrinth.index.json');
    if (!idxFile) throw new Error('Keine modrinth.index.json gefunden. Bitte eine .mrpack Datei aus Modrinth exportieren.');
    const index = JSON.parse(await idxFile.async('string'));
    importModrinthIndexToBuilder(index);
    setModrinthMessage('Importiert: ' + (index.name || file.name), 'ok');
    closeModrinthPanel();
    showToast('Modrinth-Pack importiert');
  } catch(e) {
    setModrinthMessage(e.message || 'Import fehlgeschlagen', 'err');
  } finally {
    if (input) input.value = '';
  }
}

function importModrinthIndexToBuilder(index) { document.getElementById('packName').value = index.name || 'Modrinth Pack'; document.getElementById('packVersion').value = index.versionId || '1.0.0'; if (index.dependencies?.minecraft) document.getElementById('mcVersion').value = index.dependencies.minecraft; if (index.dependencies?.['fabric-loader']) document.getElementById('fabricLoader').value = index.dependencies['fabric-loader']; MODS = []; RESOURCEPACKS = []; (index.files || []).forEach(file => { const isRP = (file.path || '').startsWith('resourcepacks/'); const filename = (file.path || '').split('/').pop() || 'project'; const name = filename.replace(/\.jar$|\.zip$/i,'').replace(/[-_]+/g,' ').trim(); const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'project'; const item = { slug, name, cat: 'Imported' }; if (isRP) RESOURCEPACKS.push(item); else MODS.push(item); }); renderMods(); renderRPs(); if (typeof updateCounters === 'function') updateCounters(); }
async function uploadCurrentPackToModrinth() { try { if (!selectedModrinthProjectId) { if (!modrinthProjects.length) await loadModrinthProjects(); if (modrinthProjects.length === 1) selectedModrinthProjectId = modrinthProjects[0].id; } if (!selectedModrinthProjectId) throw new Error('Bitte zuerst ein Modrinth-Modpack als Ziel auswaehlen.'); const mcV = document.getElementById('mcVersion').value; const pName = document.getElementById('packName').value.trim() || 'MC Toolkit Pack'; const pVer = document.getElementById('packVersion').value.trim() || new Date().toISOString().slice(0,10); const fl = document.getElementById('fabricLoader').value; setModrinthMessage('Erstelle .mrpack fuer Upload...'); const pack = await createMrpackBlob(mcV,pName,pVer,fl, ev => { if (ev.step === 'item') setModrinthMessage('Pruefe ' + (ev.index+1) + '/' + ev.total + ': ' + ev.item.name); if (ev.step === 'zip') setModrinthMessage('Pack wird verpackt...'); }); const base64 = await blobToBase64(pack.blob); setModrinthMessage('Lade zu Modrinth hoch...'); await modrinthApi('upload', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ projectId:selectedModrinthProjectId, filename:pack.filename, fileBase64:base64, name:pName, versionNumber:pVer, gameVersion:mcV, loader:'fabric' }) }); setModrinthMessage('Upload fertig: neue Version erstellt.', 'ok'); showToast('Modrinth-Version hochgeladen'); await loadModrinthProjects(); } catch(e) { setModrinthMessage(e.message, 'err'); } }
function blobToBase64(blob) { return new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); }); }
function escapeHtml(str) { return String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
document.addEventListener('DOMContentLoaded', () => { if (new URLSearchParams(location.search).get('modrinth') === 'connected') { history.replaceState(null, '', location.pathname + location.hash); openModrinthPanel(); } document.addEventListener('click', e => { if (e.target === document.getElementById('modrinthOverlay')) closeModrinthPanel(); }); });

function copyModrinthProfilesPath() {
  const path = '%appdata%\\ModrinthApp\\profiles';
  navigator.clipboard?.writeText(path).then(() => showToast('Pfad kopiert')).catch(() => setModrinthMessage(path));
}


/* ══ LUNAR CLIENT CONVERTERS ═════════════════════════════════════ */

function cleanLunarModName(name) {
  if (!name) return '';
  name = name.replace(/\.jar$/i, '');
  // Match things like "-fabric", "-forge", "-v1.0", etc. and take the first parts
  name = name.split('-')[0];
  name = name.split('_')[0];
  return name.trim();
}

function extractModsFromLunarJson(json) {
  let mods = [];
  if (json.customMods && Array.isArray(json.customMods)) {
    json.customMods.forEach(m => {
      if (typeof m === 'string') mods.push(m);
      else if (m && typeof m === 'object') {
        if (m.name) mods.push(m.name);
        else if (m.id) mods.push(m.id);
        else if (m.fileName) mods.push(m.fileName);
      }
    });
  }
  if (mods.length === 0) {
    const keysToCheck = ['mods', 'modules', 'enabledMods', 'custom_mods', 'plugins'];
    for (const key of keysToCheck) {
      if (json[key] && Array.isArray(json[key])) {
        json[key].forEach(m => {
          if (typeof m === 'string') mods.push(m);
          else if (m && typeof m === 'object') {
            if (m.name) mods.push(m.name);
            else if (m.id) mods.push(m.id);
            if (m.title) mods.push(m.title);
          }
        });
      }
    }
  }
  if (mods.length === 0) {
    function recurse(obj) {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach(recurse);
      } else if (typeof obj === 'object') {
        for (let k in obj) {
          if (k === 'name' || k === 'id' || k === 'title') {
            if (typeof obj[k] === 'string' && (obj[k].toLowerCase().includes('mod') || obj.enabled || obj.enabled === undefined)) {
              mods.push(obj[k]);
            }
          } else {
            recurse(obj[k]);
          }
        }
      }
    }
    recurse(json);
  }
  mods = [...new Set(mods)].map(m => m.replace(/\.jar$/, '')).filter(m => {
    return m.length > 2 && !['true', 'false', 'default', 'profile', 'custom'].includes(m.toLowerCase());
  });
  return mods;
}

async function convertLCToMR(btn, st, pb) {
  const { index, fileName, modsList, mcVersion } = convPackData;
  const mc  = mcVersion || '1.21.11';
  const fl  = '0.18.3';
  const name = (index && index.name) || fileName.replace(/\.[^/.]+$/, "") || 'Lunar Pack';

  const files     = modsList || [];
  const resolved  = [];
  const notFound  = [];

  for (let i = 0; i < files.length; i++) {
    const rawName = files[i];
    const cleaned = cleanLunarModName(rawName);
    pb.style.width = Math.round((i / files.length) * 85) + '%';
    st.textContent = '(' + (i+1) + '/' + files.length + ') Suche ' + cleaned + '...';

    const proj = await detectAndResolve(cleaned);
    let vf = null;

    if (proj) {
      const ver = await fetchVersion(proj.slug, mc, proj.type === 'resourcepack');
      vf = ver?.files?.find(x => x.primary) || ver?.files?.[0];
      if (vf) {
        resolved.push({
          path: (proj.type === 'resourcepack' ? 'resourcepacks/' : 'mods/') + vf.filename,
          hashes: vf.hashes,
          env: { client: 'required', server: 'unsupported' },
          downloads: [vf.url],
          fileSize: vf.size,
          name: proj.name,
          version: ver.version_number
        });
      }
    }

    if (!vf) {
      notFound.push(rawName);
    }
    await sleep(150);
  }

  pb.style.width = '100%';
  st.textContent = 'Erstelle Modrinth .mrpack...';

  if (resolved.length === 0) {
    st.textContent = '⚠ Keine kompatiblen Mods auf Modrinth gefunden.';
    btn.disabled = false;
    return;
  }

  const idx = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: '1.0.0',
    name: name,
    summary: 'Konvertiert von Lunar Client mit MC Toolkit',
    files: resolved.map(r => ({
      path: r.path,
      hashes: r.hashes,
      env: r.env,
      downloads: r.downloads,
      fileSize: r.fileSize
    })),
    dependencies: {
      minecraft: mc,
      'fabric-loader': fl
    }
  };

  const zip = new JSZip();
  zip.file('modrinth.index.json', JSON.stringify(idx, null, 2));
  zip.folder('overrides');

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const fn   = name.replace(/\s+/g, '_') + '-modrinth.mrpack';
  const blobUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fn;
  document.body.appendChild(a);
  a.click();
  a.remove();

  st.textContent = '✅ ' + resolved.length + ' Mods konvertiert' + (notFound.length ? ' · ' + notFound.length + ' nicht gefunden' : ' · Alle OK!') + ' → ' + fn;
  btn.disabled = false;
  launchConfetti();
  showOpenInApp(fn, 'modrinth', blobUrl);
}

async function convertLCToCF(btn, st, pb) {
  const { index, fileName, modsList, mcVersion } = convPackData;
  const mc  = mcVersion || '1.21.11';
  const fl  = '0.18.3';
  const name = (index && index.name) || fileName.replace(/\.[^/.]+$/, "") || 'Lunar Pack';

  const files     = modsList || [];
  const resolved  = [];
  const notFound  = [];

  for (let i = 0; i < files.length; i++) {
    const rawName = files[i];
    const cleaned = cleanLunarModName(rawName);
    pb.style.width = Math.round((i / files.length) * 85) + '%';
    st.textContent = '(' + (i+1) + '/' + files.length + ') Suche ' + cleaned + '...';

    const proj = await detectAndResolve(cleaned);
    let vf = null;

    if (proj) {
      const ver = await fetchVersion(proj.slug, mc, proj.type === 'resourcepack');
      vf = ver?.files?.find(x => x.primary) || ver?.files?.[0];
      if (vf) {
        resolved.push({
          name: proj.name,
          filename: vf.filename,
          url: vf.url,
          version: ver.version_number,
          isRP: proj.type === 'resourcepack',
          found: true
        });
      }
    }

    if (!vf) {
      notFound.push(rawName);
    }
    await sleep(150);
  }

  pb.style.width = '100%';
  st.textContent = 'Erstelle CurseForge .zip...';

  const manifest = {
    minecraft: { version: mc, modLoaders: [{ id: 'fabric-' + fl, primary: true }] },
    manifestType: 'minecraftModpack',
    manifestVersion: 1,
    name: name,
    version: '1.0.0',
    author: 'MC Toolkit',
    files: [],
    overrides: 'overrides'
  };

  const modRows = resolved.filter(m => !m.isRP).map(m =>
    '<li><a href="' + m.url + '">' + esc(m.name) + (m.version !== '?' ? ' (' + m.version + ')' : '') + '</a></li>'
  ).join('\n');
  const rpRows = resolved.filter(m => m.isRP).map(m =>
    '<li><a href="' + m.url + '">' + esc(m.name) + '</a></li>'
  ).join('\n');

  const modlistHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(name) + '</title></head><body style="font-family:sans-serif;max-width:800px;margin:2rem auto;background:#1a1a2e;color:#f0f6fc"><h1 style="color:#4ade80">📦 ' + esc(name) + '</h1><p>MC ' + mc + ' · Fabric ' + fl + ' · ' + resolved.length + ' Dateien</p><h2>Mods</h2><ul>' + modRows + '</ul>' + (rpRows ? '<h2>Texture Packs</h2><ul>' + rpRows + '</ul>' : '') + '<hr><p style="color:#666">Konvertiert mit MC Toolkit</p></body></html>';
  const readme = name + '\nMC ' + mc + ' · Fabric ' + fl + '\nKonvertiert von Lunar Client → CurseForge mit MC Toolkit\n\nMods manuell aus modlist.html herunterladen und in den mods/ Ordner legen.';

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('modlist.html', modlistHtml);
  zip.file('README.txt', readme);
  zip.folder('overrides').folder('mods');
  zip.folder('overrides').folder('resourcepacks');

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const fn   = name.replace(/\s+/g, '_') + '-curseforge.zip';
  const blobUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fn;
  document.body.appendChild(a);
  a.click();
  a.remove();

  st.textContent = '✅ ' + resolved.length + ' Mods konvertiert' + (notFound.length ? ' · ' + notFound.length + ' nicht gefunden' : ' · Alle OK!') + ' → ' + fn;
  btn.disabled = false;
  launchConfetti();
  showOpenInApp(fn, 'curseforge', blobUrl);
}
