/* ============================================================
   Djibouti Event Intelligence — API server
   Node.js + Express + SQLite. Shared multi-user workspace.
   - Real auth (bcrypt + JWT), role-based write protection
   - REST API over the shared state
   - Human-validation gates enforced server-side
   - API keys stay server-side (never sent to the browser)
   ============================================================ */
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Minimal .env loader (no dependency) — loads key=value pairs if a .env file exists.
(function loadEnv(){
  try{
    const p = path.join(__dirname, '.env');
    if(!fs.existsSync(p)) return;
    fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if(m && !line.trim().startsWith('#') && process.env[m[1]] === undefined){
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    });
  }catch(e){}
})();

const store = require('./db');

const PORT = parseInt(process.env.PORT, 10) || 4300;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
const TOKEN_TTL = '12h';

store.seedIfEmpty();

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- helpers ---------- */
const READ_ONLY_ROLES = ['lecteur'];
function sign(user){ return jwt.sign({ sub:user.id, email:user.email, role:user.role, roleName:user.roleName, name:user.name }, JWT_SECRET, { expiresIn: TOKEN_TTL }); }
function auth(req, res, next){
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!tok) return res.status(401).json({ error: 'Authentification requise' });
  try{ req.user = jwt.verify(tok, JWT_SECRET); next(); }
  catch(e){ return res.status(401).json({ error: 'Session expirée, reconnectez-vous' }); }
}
function canWrite(req, res, next){
  if(READ_ONLY_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Votre rôle (Lecteur) est en lecture seule' });
  next();
}
function isAdmin(req){ return ['super','dg'].includes(req.user.role); }
function requireSuper(req, res, next){
  if(req.user.role !== 'super') return res.status(403).json({ error: 'Réservé au Super administrateur' });
  next();
}
/* Role catalogue (server-side source of truth for role labels) */
const ROLE_LABELS = {
  super:'Super administrateur', dg:'Directeur Général', dc:'Directeur Commercial', com:'Commercial',
  event:'Event Manager', projet:'Chef de projet', finance:'Responsable Financier', comm:'Resp. Communication',
  op:'Opérateur', lecteur:'Lecteur'
};

/* ---------- auth ---------- */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = store.verifyUser(email, password);
  if(!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  if(user.disabled) return res.status(403).json({ error: 'Ce compte est désactivé. Contactez votre administrateur.' });
  res.json({ token: sign(user), user });
});
app.get('/api/auth/me', auth, (req, res) => res.json({ user: {
  id:req.user.sub, email:req.user.email, role:req.user.role, roleName:req.user.roleName, name:req.user.name } }));

/* ---------- gestion des utilisateurs (RBAC — super administrateur) ---------- */
app.get('/api/users', auth, (req, res) => res.json({ users: store.listUsers.all(), roles: ROLE_LABELS, me: req.user.sub }));

app.post('/api/users', auth, requireSuper, (req, res) => {
  const { name, email, role, password } = req.body || {};
  if(!name || !email || !role || !password) return res.status(400).json({ error: 'Champs requis manquants' });
  if(!ROLE_LABELS[role]) return res.status(400).json({ error: 'Rôle invalide' });
  if(!/.+@.+\..+/.test(email)) return res.status(400).json({ error: 'Email invalide' });
  if(password.length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum' });
  if(store.findUser.get(email.toLowerCase())) return res.status(400).json({ error: 'Un utilisateur avec cet email existe déjà' });
  const u = store.createUser({ email, name, role, roleName: ROLE_LABELS[role], password, createdBy: req.user.email, mustChangePw: true });
  store.putDoc('audit', { id:'au'+Date.now(), d: store.now(), who: req.user.name, act:'Création utilisateur', obj: email, detail:'Rôle : '+ROLE_LABELS[role] }, req.user.email);
  res.json({ ok:true, id:u.id });
});

app.put('/api/users/:id', auth, requireSuper, (req, res) => {
  const u = store.getUserById(req.params.id); if(!u) return res.status(404).json({ error:'Introuvable' });
  const { name, role, password } = req.body || {};
  if(role && !ROLE_LABELS[role]) return res.status(400).json({ error:'Rôle invalide' });
  if(password && password.length < 6) return res.status(400).json({ error:'Mot de passe : 6 caractères minimum' });
  // prevent demoting the last active super
  if(u.role === 'super' && role && role !== 'super' && store.activeSuperCount() <= 1)
    return res.status(400).json({ error:"Impossible : c'est le dernier super administrateur actif" });
  store.updateUser(req.params.id, { name, role, roleName: role?ROLE_LABELS[role]:null, password });
  res.json({ ok:true });
});

app.post('/api/users/:id/active', auth, requireSuper, (req, res) => {
  const u = store.getUserById(req.params.id); if(!u) return res.status(404).json({ error:'Introuvable' });
  const active = !!(req.body && req.body.active);
  if(!active && u.id === req.user.sub) return res.status(400).json({ error:'Vous ne pouvez pas désactiver votre propre compte' });
  if(!active && u.role==='super' && store.activeSuperCount() <= 1) return res.status(400).json({ error:"Dernier super administrateur actif" });
  store.setUserActive(req.params.id, active);
  res.json({ ok:true });
});

app.post('/api/users/:id/password', auth, requireSuper, (req, res) => {
  const u = store.getUserById(req.params.id); if(!u) return res.status(404).json({ error:'Introuvable' });
  const np = (req.body && req.body.password) || '';
  if(np.length < 6) return res.status(400).json({ error:'Mot de passe : 6 caractères minimum' });
  store.setUserPassword(req.params.id, np, true);
  res.json({ ok:true });
});

app.delete('/api/users/:id', auth, requireSuper, (req, res) => {
  const u = store.getUserById(req.params.id); if(!u) return res.status(404).json({ error:'Introuvable' });
  if(u.id === req.user.sub) return res.status(400).json({ error:'Vous ne pouvez pas supprimer votre propre compte' });
  if(u.role==='super' && store.superCount() <= 1) return res.status(400).json({ error:'Dernier super administrateur' });
  store.deleteUserById(req.params.id);
  store.putDoc('audit', { id:'au'+Date.now(), d: store.now(), who: req.user.name, act:'Suppression utilisateur', obj: u.email, detail:'' }, req.user.email);
  res.json({ ok:true });
});

/* changer son propre mot de passe (tous les rôles) */
app.post('/api/account/password', auth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if(!newPassword || newPassword.length < 6) return res.status(400).json({ error:'Nouveau mot de passe : 6 caractères minimum' });
  const check = store.verifyUser(req.user.email, oldPassword || '');
  if(!check || check.disabled) return res.status(400).json({ error:'Mot de passe actuel incorrect' });
  store.setUserPassword(req.user.sub, newPassword, false);
  res.json({ ok:true });
});

/* ---------- shared state ---------- */
app.get('/api/state', auth, (req, res) => res.json(store.fullState()));

/* bulk upsert of the whole shared state (used by the frontend save()) */
app.put('/api/state', auth, canWrite, (req, res) => {
  try{
    const body = req.body || {};
    for(const c of store.COLLECTIONS){
      if(Array.isArray(body[c])) body[c].forEach(o => { if(o && o.id) store.putDoc(c, o, req.user.email); });
    }
    if(body.settings) store.setKv('settings', body.settings);
    if(body.keywords) store.setKv('keywords', body.keywords);
    if(body.integrations) store.setKv('integrations', body.integrations);
    res.json({ ok: true });
  }catch(e){ res.status(400).json({ error: e.message }); }
});

/* generic CRUD on a collection */
app.put('/api/:collection/:id', auth, canWrite, (req, res) => {
  try{
    const obj = { ...req.body, id: req.params.id };
    const saved = store.putDoc(req.params.collection, obj, req.user.email);
    res.json(saved);
  }catch(e){ res.status(400).json({ error: e.message }); }
});
app.post('/api/:collection', auth, canWrite, (req, res) => {
  try{ res.json(store.putDoc(req.params.collection, { ...req.body }, req.user.email)); }
  catch(e){ res.status(400).json({ error: e.message }); }
});
app.delete('/api/:collection/:id', auth, canWrite, (req, res) => {
  try{ store.removeDoc(req.params.collection, req.params.id); res.json({ ok: true }); }
  catch(e){ res.status(400).json({ error: e.message }); }
});

/* settings / keywords / integrations (key-value) */
app.put('/api/kv/:key', auth, canWrite, (req, res) => {
  const allowed = ['settings','keywords','integrations'];
  if(!allowed.includes(req.params.key)) return res.status(400).json({ error: 'Clé non autorisée' });
  store.setKv(req.params.key, req.body.value);
  res.json({ ok: true, value: req.body.value });
});

/* ---------- agents (simulated, optionally backed by a server-side LLM) ---------- */
const AGENT_OUTPUTS = {
  opportunity:'2 nouvelles opportunités détectées et scorées, 1 doublon éliminé. Transmises au CRM.',
  lead:"3 fiches prospects enrichies (décideurs + budget estimé). 1 classée « Information insuffisante ».",
  strategy:'Stratégie générée pour 1 prospect : concept + 3 offres (Essentielle / Pro / Premium).',
  planning:'Plan opérationnel créé : 32 tâches, RACI, checklists jour-J, registre des risques.',
  writing:'Proposition rédigée en Français (ton Institutionnel). Versions PDF / Email / PPT prêtes.',
  compliance:'Contrôle effectué : 1 blocage (marge sous seuil), 2 contenus « À vérifier ». Envoi bloqué.',
  outreach:'1 email préparé et mis en file. En attente de validation humaine avant envoi.',
  followup:'Réponse détectée → séquence de relance suspendue automatiquement.',
  negotiation:"Simulation de 3 scénarios budgétaires. Prix minimum acceptable calculé (marge ≥ 22%).",
  execution:'Rapport quotidien généré : 11/32 tâches faites, 2 risques ouverts, 5/9 fournisseurs confirmés.',
  finance:"Alerte marge sur l'offre révisée Djibouti Telecom (18% < 22%). Rentabilité recalculée.",
  supervisor:'Priorisation mise à jour, 2 prospects escaladés, 1 automatisation suspendue pour anomalie.',
};
const AGENT_NAMES = {
  opportunity:'Opportunity Intelligence', lead:'Lead Research', strategy:'Proposal Strategy', planning:'Planning & Operations',
  writing:'Commercial Writing', compliance:'Approval & Compliance', outreach:'Customer Outreach', followup:'Follow-up',
  negotiation:'Negotiation Support', execution:'Execution Monitoring', finance:'Finance & Profitability', supervisor:'Supervisor',
};

// Optional real LLM call (server-side only — key never leaves the server)
async function llmSummary(agentId, context){
  const key = process.env.ANTHROPIC_API_KEY;
  if(!key) return null;
  try{
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-sonnet-5', max_tokens:300,
        messages:[{ role:'user', content:`Tu es l'agent "${AGENT_NAMES[agentId]}" d'une plateforme événementielle à Djibouti. En 2 phrases max, en français, résume une action utile que tu viens d'accomplir. Contexte: ${context||'—'}` }] })
    });
    if(!r.ok) return null;
    const j = await r.json();
    return (j.content && j.content[0] && j.content[0].text) ? j.content[0].text.trim() : null;
  }catch(e){ return null; }
}

app.post('/api/agents/:id/run', auth, canWrite, async (req, res) => {
  const id = req.params.id;
  if(!AGENT_OUTPUTS[id]) return res.status(404).json({ error: 'Agent inconnu' });
  const live = await llmSummary(id, req.body && req.body.context);
  const msg = live || AGENT_OUTPUTS[id];
  const log = store.putDoc('agentLog', { d: store.now(), agent: AGENT_NAMES[id], msg }, req.user.email);
  res.json({ output: msg, live: !!live, log });
});

/* veille scan — adds a new opportunity with a computed score (dedup-aware) */
const SCAN_CANDIDATES = [
  {org:'Port de Djibouti (DPFZA)', type:'Inauguration', title:'Inauguration nouveau terminal', source:'Communiqué DPFZA', budget:8300000, participants:350, urgency:'Haute', contact:'Direction Communication', signals:['Institutionnel','Délégations','Presse']},
  {org:'JICA Djibouti', type:'Séminaire', title:'Séminaire coopération technique', source:'Site JICA public', budget:3900000, participants:150, urgency:'Moyenne', contact:'Bureau de coordination', signals:['International','Coopération']},
  {org:'Lycée Français Kessel', type:'Événement scolaire', title:'Kermesse annuelle', source:'Page publique établissement', budget:1200000, participants:500, urgency:'Basse', contact:'Direction', signals:['Grand public','Récurrent']},
];
app.post('/api/veille/scan', auth, canWrite, (req, res) => {
  const opps = store.getCollection('opportunities');
  const pick = SCAN_CANDIDATES[opps.length % SCAN_CANDIDATES.length];
  if(opps.some(o => o.org === pick.org && o.title === pick.title))
    return res.json({ added: false, reason: 'Doublon éliminé — aucune nouvelle opportunité' });
  const score = Math.min(94, 55 + Math.round((pick.budget/1000000)*3) + (pick.urgency==='Haute'?12:pick.urgency==='Moyenne'?6:0));
  const o = store.putDoc('opportunities', { ...pick, found: store.now(),
    eventDate: new Date(Date.now() + (25 + opps.length*3)*86400000).toISOString(),
    score, converted:false, summary:`Opportunité détectée par veille automatique. ${pick.signals.join(', ')}.`, sourceUrl:'#' }, req.user.email);
  store.putDoc('agentLog', { d: store.now(), agent:'Opportunity Intelligence', msg:`Nouvelle opportunité : ${pick.org} (score ${score})` }, req.user.email);
  res.json({ added: true, opportunity: o, score });
});

/* admin: reset demo data */
app.post('/api/admin/reset', auth, (req, res) => {
  if(!isAdmin(req)) return res.status(403).json({ error: 'Réservé au DG / administrateur' });
  store.db.exec('DELETE FROM docs; DELETE FROM kv;');
  store.seedIfEmpty();
  res.json({ ok: true });
});

/* health */
app.get('/api/health', (req, res) => res.json({ ok:true, llm: !!process.env.ANTHROPIC_API_KEY }));

/* SPA fallback (Express 5 — use a catch-all middleware, not '*') */
app.use((req, res) => {
  if(req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint introuvable' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* Open the user's default browser to the app (skipped when headless/disabled). */
function openBrowser(url){
  if(process.env.NO_OPEN === '1' || !process.stdout.isTTY) return;
  try{
    const { spawn } = require('child_process');
    const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  }catch(e){}
}

/* Start on PORT; if it is already used by another app, automatically try the next ports. */
function start(port, attemptsLeft){
  const server = app.listen(port, () => {
    console.log(`\n  ============================================================`);
    console.log(`   Djibouti Event Intelligence — Plateforme IA événementielle`);
    console.log(`  ============================================================`);
    console.log(`   ➜  Ouvrez :  http://localhost:${port}`);
    console.log(`   Comptes démo (mot de passe : demo1234) :`);
    console.log(`      dg@djib-events.dj · commercial@djib-events.dj · finance@djib-events.dj`);
    console.log(`   IA temps réel : ${process.env.ANTHROPIC_API_KEY ? 'activée (Anthropic)' : 'désactivée (agents simulés)'}`);
    console.log(`   (Arrêter le serveur : Ctrl + C)\n`);
    openBrowser(`http://localhost:${port}`);
  });
  server.on('error', (err) => {
    if(err.code === 'EADDRINUSE' && attemptsLeft > 0){
      console.log(`  ⚠️  Le port ${port} est déjà utilisé par une autre application — essai sur ${port+1}…`);
      start(port + 1, attemptsLeft - 1);
    }else{
      console.error(`  ⛔ Impossible de démarrer le serveur : ${err.message}`);
      process.exit(1);
    }
  });
}
start(PORT, 15);
