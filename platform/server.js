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
const TOKEN_TTL = process.env.TOKEN_TTL || '7d';

store.seedIfEmpty();

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, p) => { if(p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache, must-revalidate'); }
}));

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
  if(u.role==='super') return res.status(400).json({ error:'Un super administrateur ne peut pas être supprimé.' });
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
// Raw HTTP to match the rest of this file (no SDK dependency on the VPS).
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const ANTHROPIC_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1/messages';
async function callClaude({ system, user, maxTokens = 1200, effort = 'low' }){
  const key = process.env.ANTHROPIC_API_KEY;
  if(!key) return null;
  try{
    const body = { model: CLAUDE_MODEL, max_tokens: maxTokens, output_config: { effort },
      messages: [{ role: 'user', content: user }] };
    if(system) body.system = system;
    const r = await fetch(ANTHROPIC_URL, {
      method:'POST',
      headers:{ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify(body)
    });
    if(!r.ok) return null;
    const j = await r.json();
    if(j.stop_reason === 'refusal') return null;
    const txt = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return txt || null;
  }catch(e){ return null; }
}
async function llmSummary(agentId, context){
  return callClaude({ maxTokens: 220,
    user:`Tu es l'agent "${AGENT_NAMES[agentId]}" d'une plateforme événementielle à Djibouti. En 2 phrases max, en français, résume une action utile que tu viens d'accomplir. Contexte: ${context||'—'}` });
}

app.post('/api/agents/:id/run', auth, canWrite, async (req, res) => {
  const id = req.params.id;
  if(!AGENT_OUTPUTS[id]) return res.status(404).json({ error: 'Agent inconnu' });
  const live = await llmSummary(id, req.body && req.body.context);
  const msg = live || AGENT_OUTPUTS[id];
  const log = store.putDoc('agentLog', { d: store.now(), agent: AGENT_NAMES[id], msg }, req.user.email);
  res.json({ output: msg, live: !!live, log });
});

/* ---------- IA : rédaction de proposition commerciale (Agents 3 + 5) ---------- */
app.post('/api/ai/proposal', auth, canWrite, async (req, res) => {
  const { prospectId, tier='Professionnelle', lang='Français', tone='Commercial', type='Événement' } = req.body || {};
  const p = store.getCollection('prospects').find(x => x.id === prospectId);
  if(!p) return res.status(404).json({ error: 'Prospect introuvable' });
  const opp = store.getCollection('opportunities').find(o => o.id === p.opId) || {};
  const ctx = `Client: ${p.org}. Contact: ${p.contact} (${p.fonction||'—'}). Secteur: ${p.sector}. Type d'événement: ${type}. Besoin détecté: ${opp.title||'—'}${opp.summary?' — '+opp.summary:''}. Budget estimé: ${p.value} DJF.`;
  const text = await callClaude({
    system: `Tu es un expert en organisation d'événements à Djibouti. Tu rédiges des propositions commerciales professionnelles, structurées et convaincantes. Réponds uniquement avec le contenu de la proposition, en ${lang}, sur un ton ${tone}. Utilise des montants en DJF cohérents.`,
    user: `Rédige une proposition commerciale (formule « ${tier} ») pour ce client.\n${ctx}\n\nStructure attendue : 1) Contexte & compréhension du besoin ; 2) Concept proposé ; 3) Services inclus ; 4) Déroulé / programme ; 5) Budget indicatif (cohérent avec ${p.value} DJF) ; 6) Conditions & prochaines étapes. Personnalise selon le client. Environ 400–600 mots.`,
    maxTokens: 2000, effort: 'low'
  });
  res.json({ live: !!text, text: text || `Proposition « ${tier} » pour ${p.org} — ${type}.\n\n(Brouillon modèle — activez l'IA côté serveur pour une rédaction personnalisée.)` });
});

/* ---------- IA : rédaction d'un email de prospection (Agent 7) ---------- */
app.post('/api/ai/outreach', auth, canWrite, async (req, res) => {
  const { prospectId } = req.body || {};
  const p = store.getCollection('prospects').find(x => x.id === prospectId);
  if(!p) return res.status(404).json({ error: 'Prospect introuvable' });
  const opp = store.getCollection('opportunities').find(o => o.id === p.opId) || {};
  const text = await callClaude({
    system: `Tu rédiges des emails de prospection B2B courtois, personnalisés et concis pour une agence événementielle à Djibouti. Réponds en français. Format exact : première ligne « Objet: ... », puis une ligne vide, puis le corps de l'email (120–180 mots).`,
    user: `Prospect : ${p.org}, contact ${p.contact} (${p.fonction||'—'}). Événement détecté : ${opp.title||'leur événement'} (${opp.type||''}). Propose un rendez-vous de 20 minutes. Signature : ${req.user.name}, Djibouti Event Intelligence.`,
    maxTokens: 600
  });
  if(!text) return res.json({ live:false, subject:`${opp.type||'Votre événement'} à Djibouti — accompagnement`, body:`Bonjour ${p.contact},\n\nNous serions honorés d'accompagner ${p.org}.\n\nCordialement,\n${req.user.name}` });
  const m = text.match(/^\s*Objet\s*:\s*(.+)/i);
  const subject = m ? m[1].trim() : `${opp.type||'Votre événement'} à Djibouti`;
  const bodyTxt = text.replace(/^\s*Objet\s*:.*(\r?\n)?/i, '').trim();
  res.json({ live:true, subject, body: bodyTxt });
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

/* ---------- Veille RÉELLE : recherche web via l'outil de recherche d'Anthropic ---------- */
function scoreOpp(budget, urgency){
  return Math.min(96, 52 + Math.round(((+budget||0)/1000000)*3) + (urgency==='Haute'?14:urgency==='Moyenne'?7:0));
}
/* Choix du moteur de veille, par ordre de préférence :
   1) Tavily Search  — offre gratuite SANS carte bancaire (recommandé) : https://app.tavily.com
   2) Brave Search   — fiable mais l'inscription demande une carte bancaire
   3) Recherche web intégrée d'Anthropic — repli (limitée selon le compte).
   Dans tous les cas, l'IA n'extrait des événements QU'À PARTIR des URL réelles renvoyées. */
async function veilleFindEvents(keywords){
  if(process.env.TAVILY_API_KEY) return veilleViaWeb('tavily', tavilySearch, keywords);
  if(process.env.BRAVE_API_KEY)  return veilleViaWeb('brave',  braveSearch,  keywords);
  return webSearchEvents(keywords);
}
/* Requêtes de recherche communes à tous les fournisseurs. */
function veilleQueries(keywords){
  const year = new Date().getFullYear();
  return [
    `événements à venir Djibouti ${year}`,
    `conférence forum séminaire Djibouti ${year}`,
    `inauguration cérémonie gala salon Djibouti`,
  ].concat((keywords||[]).slice(0,2));
}
/* Brave Search API — renvoie [{title,url,description}]. */
const BRAVE_URL = (process.env.BRAVE_BASE_URL || 'https://api.search.brave.com') + '/res/v1/web/search';
async function braveSearch(query){
  const r = await fetch(BRAVE_URL + '?count=5&q=' + encodeURIComponent(query),
    { headers: { 'Accept':'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY } });
  if(!r.ok) throw new Error('Brave ' + r.status);
  const j = await r.json();
  return ((j.web && j.web.results) || []).map(x => ({ title:x.title, url:x.url, description:x.description || '' }));
}
/* Tavily Search API — renvoie [{title,url,description}]. Gratuit, sans carte bancaire. */
const TAVILY_URL = (process.env.TAVILY_BASE_URL || 'https://api.tavily.com') + '/search';
async function tavilySearch(query){
  const r = await fetch(TAVILY_URL, { method:'POST',
    headers:{ 'content-type':'application/json', 'Authorization':'Bearer ' + process.env.TAVILY_API_KEY },
    body: JSON.stringify({ query, max_results: 5, search_depth: 'basic' }) });
  if(!r.ok) throw new Error('Tavily ' + r.status);
  const j = await r.json();
  return ((j.results) || []).map(x => ({ title:x.title, url:x.url, description:x.content || '' }));
}
/* Moteur générique : lance les requêtes via searchFn puis demande à l'IA d'en extraire les événements. */
async function veilleViaWeb(label, searchFn, keywords){
  try{
    const queries = veilleQueries(keywords);
    let results = [];
    for(const q of queries){ try{ results = results.concat(await searchFn(q)); }catch(e){ console.error('[veille] '+label, e.message); } }
    const seen = new Set();
    results = results.filter(r => r.url && !seen.has(r.url) && seen.add(r.url)).slice(0, 25);
    console.error('[veille] '+label+': '+results.length+' résultats web');
    if(!results.length) return { error: label + '_no_results' };
    const list = results.map((r,i) => `${i+1}. ${r.title} | ${r.url} | ${r.description}`).join('\n');
    const text = await callClaude({
      system: `Tu es l'agent de veille d'une agence événementielle à Djibouti. À partir de résultats de recherche web, tu identifies des ÉVÉNEMENTS à Djibouti (à venir ou récurrents/annuels) pouvant nécessiter un prestataire. N'invente JAMAIS d'URL : utilise uniquement les URL fournies.`,
      user: `Nous sommes le ${new Date().toISOString().slice(0,10)}. Résultats de recherche web (numéro. titre | url | description) :\n${list}\n\nExtrais jusqu'à 8 événements à Djibouti pertinents. Réponds UNIQUEMENT par un tableau JSON (rien d'autre, pas de markdown), format : [{"org":"","title":"","type":"","eventDate":"AAAA-MM-JJ ou null","sourceUrl":"UNE des URL ci-dessus","contact":null,"participants":200,"budget":3000000,"urgency":"Haute|Moyenne|Basse","summary":"","signals":[]}]. Si aucun événement pertinent, réponds exactement : []`,
      maxTokens: 2800, effort: 'low'
    });
    const arr = extractJsonArray(text);
    console.error('[veille] '+label+' → événements:', Array.isArray(arr) ? arr.length : 'PARSE_FAIL', '| extrait:', JSON.stringify((text||'').slice(0,160)));
    if(!Array.isArray(arr)) return { error: 'parse', raw: (text||'').slice(0,300) };
    return { events: arr };
  }catch(e){ console.error('[veille] '+label+' exception', e.message); return { error: e.message }; }
}
async function webSearchEvents(keywords){
  const key = process.env.ANTHROPIC_API_KEY;
  if(!key) return { error: 'IA non configurée' };
  const system = `Tu es l'agent de veille "Opportunity Intelligence" d'une agence événementielle à Djibouti. Tu cherches sur le web des ÉVÉNEMENTS À VENIR à Djibouti (conférences, forums, séminaires, ateliers, salons, lancements de produit, inaugurations, cérémonies officielles, galas, réceptions diplomatiques, remises de diplômes, assemblées générales, etc.) annoncés sur des sources PUBLIQUES (sites officiels, ministères, ambassades, organisations internationales, chambre de commerce, médias, universités, grandes entreprises). N'utilise que des sources publiques et cite l'URL de la source.`;
  const today = new Date().toISOString().slice(0,10);
  const user = `Nous sommes le ${today}. Trouve jusqu'à 8 événements à Djibouti (à venir dans les 12 prochains mois, OU récurrents/annuels dont une prochaine édition est probable) qui pourraient nécessiter un prestataire événementiel. Inclure aussi les événements annoncés récemment dans la presse locale. Mots-clés indicatifs : ${(keywords||[]).join(', ')}.
Fais plusieurs recherches web (ministères, ambassades, ONU/organisations internationales, chambre de commerce, universités, grandes entreprises, presse : lanationdj.com, adi.dj).

Effectue d'abord tes recherches web, PUIS termine ta réponse par le résultat.
Le résultat DOIT être un tableau JSON valide et RIEN d'autre après : pas de commentaire, pas de bloc de code markdown, pas de numéros de citation. Commence le tableau par [ et termine par ]. Format exact de chaque objet :
[{"org":"organisation","title":"titre de l'événement","type":"type d'événement","eventDate":"AAAA-MM-JJ ou null si inconnue","sourceUrl":"https://... (URL réelle de la page)","contact":"contact public ou null","participants":<nombre estimé>,"budget":<estimation en DJF>,"urgency":"Haute|Moyenne|Basse","summary":"résumé en 1-2 phrases","signals":["signal1","signal2"]}]
Estime une date et un budget plausibles si non précisés. Si vraiment aucun événement pertinent, réponds exactement : []`;
  const tools = [{ type:'web_search_20260209', name:'web_search', max_uses: 8 }];
  let messages = [{ role:'user', content: user }], text = '', guard = 0, apiError = null;
  try{
    while(guard++ < 6){
      const r = await fetch(ANTHROPIC_URL, { method:'POST',
        headers:{ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4000, system, tools, messages }) });
      if(!r.ok){
        const t = await r.text();
        console.error('[veille] API non-OK', r.status, t.slice(0,300));
        // Fallback automatique si l'outil web n'est pas disponible pour ce modèle/compte
        if(r.status===400 && /web_search|tool/i.test(t)) return { error: 'web_tool_unsupported' };
        return { error: `API ${r.status}` };
      }
      const j = await r.json();
      text += (j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
      if(j.stop_reason === 'pause_turn'){ messages.push({ role:'assistant', content: j.content }); continue; }
      break;
    }
  }catch(e){ console.error('[veille] exception', e.message); return { error: e.message }; }
  // Extraction robuste du tableau JSON (gère le texte autour, les citations [1], les ```json)
  const arr = extractJsonArray(text);
  console.error('[veille] texte reçu ('+text.length+' car.), extrait:', JSON.stringify(text.slice(0,200)), '→ événements:', Array.isArray(arr)?arr.length:'PARSE_FAIL');
  if(!Array.isArray(arr)) return { error: 'parse', raw: text.slice(0,300) };
  return { events: arr };
}
function extractJsonArray(text){
  if(!text) return null;
  let t = String(text).replace(/```+\s*json/gi, '').replace(/```+/g, '').trim();
  const candidates = [];
  // 1) un tableau d'OBJETS (ignore les citations type [1], [2] grâce au "[{")
  const m = t.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if(m) candidates.push(m[0]);
  // 2) repli : du premier [ au dernier ]
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if(a >= 0 && b > a) candidates.push(t.slice(a, b + 1));
  for(const c of candidates){
    try{ const parsed = JSON.parse(c); if(Array.isArray(parsed)) return parsed; }catch(e){}
  }
  return null;
}
app.post('/api/veille/search', auth, canWrite, async (req, res) => {
  const keywords = store.getKvVal('keywords', []);
  const out = await veilleFindEvents(keywords);
  if(out.error){
    const code = out.error==='IA non configurée' ? 400 : 502;
    return res.status(code).json({ error: out.error, raw: out.raw });
  }
  const existing = store.getCollection('opportunities');
  const norm = s => (s||'').toLowerCase().trim();
  let added = [];
  for(const ev of out.events){
    if(!ev || !ev.org || !ev.title) continue;
    if(existing.some(o => norm(o.org)===norm(ev.org) && norm(o.title)===norm(ev.title))) continue;
    if(added.some(o => norm(o.org)===norm(ev.org) && norm(o.title)===norm(ev.title))) continue;
    let eventDate = null;
    if(ev.eventDate && ev.eventDate!=='null'){ const d=new Date(ev.eventDate); if(!isNaN(d)) eventDate=d.toISOString(); }
    if(!eventDate) eventDate = new Date(Date.now() + 35*86400000).toISOString();
    const score = scoreOpp(ev.budget, ev.urgency);
    const o = store.putDoc('opportunities', {
      org:String(ev.org).slice(0,120), title:String(ev.title).slice(0,160), type:ev.type||'Événement',
      source:'Recherche web (IA)', sourceUrl:ev.sourceUrl||'#', found: store.now(), eventDate,
      score, budget:+ev.budget||0, participants:+ev.participants||0, urgency:ev.urgency||'Moyenne',
      contact:ev.contact||'—', converted:false, summary:ev.summary||'', signals:Array.isArray(ev.signals)?ev.signals:[]
    }, req.user.email);
    added.push(o);
  }
  if(added.length) store.putDoc('agentLog', { d: store.now(), agent:'Opportunity Intelligence',
    msg:`Veille web : ${added.length} nouvelle(s) opportunité(s) détectée(s)` }, req.user.email);
  res.json({ added: added.length, found: out.events.length, duplicates: out.events.filter(e=>e&&e.org&&e.title).length - added.length, opportunities: added });
});

/* ---------- Veille assistée : l'utilisateur colle un lien / un texte, l'IA structure l'opportunité ----------
   100 % fiable, sans service de recherche externe. La source reste celle fournie par l'utilisateur. */
function extractJsonObject(text){
  if(!text) return null;
  let t = String(text).replace(/```+\s*json/gi, '').replace(/```+/g, '').trim();
  const candidates = [];
  const m = t.match(/\{[\s\S]*\}/);
  if(m) candidates.push(m[0]);
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a >= 0 && b > a) candidates.push(t.slice(a, b + 1));
  for(const c of candidates){ try{ const p = JSON.parse(c); if(p && typeof p==='object' && !Array.isArray(p)) return p; }catch(e){} }
  return null;
}
app.post('/api/veille/assist', auth, canWrite, async (req, res) => {
  const raw = (req.body && (req.body.text || req.body.url) || '').toString().trim();
  if(!raw) return res.status(400).json({ error: 'Collez un lien ou une description d\'événement.' });
  if(!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'IA non configurée côté serveur.' });
  // Détecte une URL dans le texte collé (servira de source cliquable).
  const urlMatch = raw.match(/https?:\/\/[^\s)]+/);
  const providedUrl = urlMatch ? urlMatch[0] : '';
  let obj;
  try{
    const text = await callClaude({
      system: `Tu es l'agent "Opportunity Intelligence" d'une agence événementielle à Djibouti. À partir d'un texte ou d'un lien fourni par un utilisateur, tu structures UNE opportunité d'événement. N'invente pas d'URL : si une URL est fournie, utilise-la comme source ; sinon laisse sourceUrl vide.`,
      user: `Nous sommes le ${new Date().toISOString().slice(0,10)}. Voici ce que l'utilisateur a collé (lien et/ou description) :\n"""\n${raw.slice(0,4000)}\n"""\n\nStructure UNE opportunité. Réponds UNIQUEMENT par un objet JSON (rien d'autre, pas de markdown), format exact :\n{"org":"organisation ou organisateur","title":"titre de l'événement","type":"type (conférence, forum, gala, inauguration, ...)","eventDate":"AAAA-MM-JJ ou null si inconnue","sourceUrl":"${providedUrl || 'laisser vide si aucune URL fournie'}","contact":"contact public ou null","participants":<nombre estimé>,"budget":<estimation en DJF>,"urgency":"Haute|Moyenne|Basse","summary":"résumé en 1-2 phrases","signals":["indice1","indice2"]}\nEstime une date et un budget plausibles si non précisés.`,
      maxTokens: 1200, effort: 'low'
    });
    obj = extractJsonObject(text);
    if(!obj) return res.status(502).json({ error: 'parse', raw: (text||'').slice(0,300) });
  }catch(e){ console.error('[veille] assist', e.message); return res.status(502).json({ error: e.message }); }
  if(!obj.org || !obj.title) return res.status(422).json({ error: 'L\'IA n\'a pas pu identifier d\'événement dans ce texte. Ajoutez plus de détails.' });
  const existing = store.getCollection('opportunities');
  const norm = s => (s||'').toLowerCase().trim();
  if(existing.some(o => norm(o.org)===norm(obj.org) && norm(o.title)===norm(obj.title)))
    return res.status(409).json({ error: 'Cette opportunité existe déjà.' });
  let eventDate = null;
  if(obj.eventDate && obj.eventDate!=='null'){ const d=new Date(obj.eventDate); if(!isNaN(d)) eventDate=d.toISOString(); }
  if(!eventDate) eventDate = new Date(Date.now() + 35*86400000).toISOString();
  const sourceUrl = providedUrl || (/^https?:\/\//.test(obj.sourceUrl||'') ? obj.sourceUrl : '#');
  const o = store.putDoc('opportunities', {
    org:String(obj.org).slice(0,120), title:String(obj.title).slice(0,160), type:obj.type||'Événement',
    source:'Ajout assisté (IA)', sourceUrl, found: store.now(), eventDate,
    score: scoreOpp(obj.budget, obj.urgency), budget:+obj.budget||0, participants:+obj.participants||0,
    urgency:obj.urgency||'Moyenne', contact:obj.contact||'—', converted:false,
    summary:obj.summary||'', signals:Array.isArray(obj.signals)?obj.signals:[]
  }, req.user.email);
  store.putDoc('agentLog', { d: store.now(), agent:'Opportunity Intelligence',
    msg:`Ajout assisté : « ${o.title} » structuré par l'IA` }, req.user.email);
  res.json({ opportunity: o });
});

/* ---------- Envoi réel d'emails (SMTP, après validation humaine) ---------- */
let _mailer = null, _mailerKey = '';
function getMailer(){
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  const key = [process.env.SMTP_JSON, host, process.env.SMTP_PORT, process.env.SMTP_SECURE, user].join('|');
  if(_mailer && _mailerKey === key) return _mailer;
  const nodemailer = require('nodemailer');
  if(process.env.SMTP_JSON === '1'){ _mailer = nodemailer.createTransport({ jsonTransport: true }); _mailerKey = key; return _mailer; }
  if(!host || !user || !pass) return null;
  _mailer = nodemailer.createTransport({
    host, port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_SECURE || 'true') !== 'false',
    auth: { user, pass }
  });
  _mailerKey = key;
  return _mailer;
}
function emailConfigured(){ return process.env.SMTP_JSON === '1' || !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS); }
const emailFrom = () => process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@techiftiin.online';

app.get('/api/email/status', auth, (req, res) =>
  res.json({ configured: emailConfigured(), from: emailConfigured() ? emailFrom() : null }));

app.post('/api/email/send', auth, canWrite, async (req, res) => {
  const { to, subject, body } = req.body || {};
  if(!to || !/.+@.+\..+/.test(to)) return res.status(400).json({ error: 'Destinataire (email) invalide' });
  if(!subject) return res.status(400).json({ error: "Objet requis" });
  const m = getMailer();
  if(!m) return res.status(400).json({ error: "Envoi d'emails non configuré (SMTP). Voir Paramètres → Email." });
  try{
    const info = await m.sendMail({ from: emailFrom(), to, subject, text: body || '' });
    store.putDoc('audit', { id:'au'+Date.now(), d: store.now(), who: req.user.name, act:'Email envoyé', obj: subject, detail:'→ '+to }, req.user.email);
    res.json({ ok: true, id: info.messageId || null });
  }catch(e){ res.status(502).json({ error: 'Échec SMTP : ' + e.message }); }
});

app.post('/api/email/test', auth, canWrite, async (req, res) => {
  const to = (req.body && req.body.to) || req.user.email;
  const m = getMailer();
  if(!m) return res.status(400).json({ error: 'SMTP non configuré (renseignez SMTP_HOST / SMTP_USER / SMTP_PASS dans .env)' });
  try{
    await m.sendMail({ from: emailFrom(), to, subject: 'Test — Djibouti Event Intelligence',
      text: "Ceci est un email de test. Votre configuration SMTP fonctionne ✅" });
    res.json({ ok: true, to });
  }catch(e){ res.status(502).json({ error: 'Échec SMTP : ' + e.message }); }
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
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
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
