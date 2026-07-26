/* ============================================================
   Database layer — SQLite (better-sqlite3)
   Document-store model: one row per record, JSON payload, so the
   server mirrors the frontend object shapes exactly.
   ============================================================ */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    role TEXT NOT NULL, role_name TEXT NOT NULL, pass_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS docs (
    collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
    updated_at TEXT NOT NULL, updated_by TEXT,
    PRIMARY KEY (collection, id)
  );
  CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
`);

/* ---------- collections that make up the shared app state ---------- */
const COLLECTIONS = ['opportunities','prospects','proposals','approvals','events','tasks','audit','agentLog'];

/* ---------- helpers ---------- */
const now = () => new Date().toISOString();
const upsertDoc = db.prepare(`INSERT INTO docs (collection,id,data,updated_at,updated_by)
  VALUES (@collection,@id,@data,@updated_at,@updated_by)
  ON CONFLICT(collection,id) DO UPDATE SET data=@data, updated_at=@updated_at, updated_by=@updated_by`);
const delDoc = db.prepare(`DELETE FROM docs WHERE collection=? AND id=?`);
const listDocs = db.prepare(`SELECT id,data FROM docs WHERE collection=? ORDER BY updated_at DESC`);
const getKv = db.prepare(`SELECT v FROM kv WHERE k=?`);
const setKvStmt = db.prepare(`INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`);

function putDoc(collection, obj, by){
  if(!COLLECTIONS.includes(collection)) throw new Error('Collection inconnue: '+collection);
  if(!obj.id) obj.id = collection.slice(0,2) + Math.random().toString(36).slice(2,9);
  upsertDoc.run({collection, id:obj.id, data:JSON.stringify(obj), updated_at:now(), updated_by:by||null});
  return obj;
}
function removeDoc(collection, id){ delDoc.run(collection, id); }
function getCollection(collection){ return listDocs.all(collection).map(r=>JSON.parse(r.data)); }
function setKv(k, v){ setKvStmt.run(k, JSON.stringify(v)); }
function getKvVal(k, def){ const r=getKv.get(k); return r ? JSON.parse(r.v) : def; }

/* full shared state used by the frontend on load */
function fullState(){
  const state = {};
  for(const c of COLLECTIONS) state[c] = getCollection(c);
  state.settings = getKvVal('settings', {});
  state.keywords = getKvVal('keywords', []);
  state.integrations = getKvVal('integrations', {});
  return state;
}

/* ---------- users ---------- */
const insUser = db.prepare(`INSERT INTO users (id,email,name,role,role_name,pass_hash,created_at)
  VALUES (@id,@email,@name,@role,@role_name,@pass_hash,@created_at)`);
const findUser = db.prepare(`SELECT * FROM users WHERE email=?`);
const listUsers = db.prepare(`SELECT id,email,name,role,role_name,created_at FROM users`);
function createUser({email,name,role,roleName,password}){
  const u = {id:'u'+Math.random().toString(36).slice(2,9), email:email.toLowerCase(), name, role, role_name:roleName,
    pass_hash:bcrypt.hashSync(password,10), created_at:now()};
  insUser.run(u); return u;
}
function verifyUser(email,password){
  const u = findUser.get((email||'').toLowerCase());
  if(!u) return null;
  if(!bcrypt.compareSync(password, u.pass_hash)) return null;
  return {id:u.id, email:u.email, name:u.name, role:u.role, roleName:u.role_name};
}

/* ============================================================
   SEED — runs once on an empty database
   ============================================================ */
function seedIfEmpty(){
  const seeded = getKvVal('seeded', false);
  if(seeded) return;

  const D = 86400000, base = Date.now();
  const mk = d => new Date(base + d*D).toISOString();

  // --- users (demo accounts) ---
  const demoUsers = [
    {email:'admin@djib-events.dj',      name:'Super Admin',        role:'super',   roleName:'Super administrateur', password:'demo1234'},
    {email:'dg@djib-events.dj',         name:'Directeur Général',  role:'dg',      roleName:'Directeur Général',    password:'demo1234'},
    {email:'commercial@djib-events.dj', name:'Commercial',         role:'com',     roleName:'Commercial',           password:'demo1234'},
    {email:'finance@djib-events.dj',    name:'Resp. Financier',    role:'finance', roleName:'Responsable Financier',password:'demo1234'},
    {email:'lecteur@djib-events.dj',    name:'Lecteur',            role:'lecteur', roleName:'Lecteur',              password:'demo1234'},
  ];
  demoUsers.forEach(u=>{ if(!findUser.get(u.email)) createUser(u); });

  // --- settings / keywords / integrations ---
  setKv('settings', {dailyLimit:40, hourlyLimit:8, marginMin:22, followupDelays:[3,7,14], defaultLang:'Français', defaultTone:'Commercial'});
  setKv('keywords', ['Djibouti conference','Djibouti forum','Djibouti seminar','Djibouti summit','Djibouti inauguration','Djibouti gala','Djibouti embassy event','Djibouti corporate event','Djibouti graduation','Djibouti wedding','Djibouti exhibition','Djibouti delegation','مؤتمر جيبوتي','ملتقى جيبوتي']);
  setKv('integrations', {gmail:true, gcal:true, pdf:true, anthropic:!!process.env.ANTHROPIC_API_KEY, wa:false, maps:true});

  const put = (c,o)=>putDoc(c,o,'seed');

  // --- opportunities ---
  [
    {id:'op1', org:"Ministère de l'Économie et des Finances", type:'Forum', title:"Forum National sur l'Investissement", source:'Site officiel du ministère', sourceUrl:'https://economie.gouv.dj', found:mk(-2), eventDate:mk(28), score:88, budget:9500000, participants:400, urgency:'Haute', contact:'Direction de la Communication', converted:true, summary:"Le ministère annonce un forum d'investissement de grande ampleur ; besoin probable d'un prestataire événementiel complet.", signals:['Appel public','Délégations étrangères','Budget institutionnel']},
    {id:'op2', org:'Djibouti Telecom', type:'Lancement de produit', title:'Lancement offre Fibre 5G', source:'Communiqué de presse', sourceUrl:'https://djiboutitelecom.dj', found:mk(-1), eventDate:mk(21), score:81, budget:6200000, participants:250, urgency:'Haute', contact:'Responsable Marketing', converted:true, summary:"Lancement d'une nouvelle offre grand public ; forte probabilité d'activation de marque et soirée presse.", signals:['Activation marque','Presse','Grand public']},
    {id:'op3', org:'Ambassade de France', type:'Réception diplomatique', title:'Fête nationale du 14 juillet', source:'Calendrier public ambassade', sourceUrl:'https://dj.ambafrance.org', found:mk(-3), eventDate:mk(40), score:76, budget:4800000, participants:300, urgency:'Moyenne', contact:'Service protocole', converted:false, summary:"Réception diplomatique annuelle ; besoins protocole, traiteur haut de gamme, sécurité.", signals:['Diplomatique','Protocole','Récurrent']},
    {id:'op4', org:'Université de Djibouti', type:'Graduation', title:'Cérémonie de remise des diplômes 2026', source:'Page publique université', sourceUrl:'https://univ.edu.dj', found:mk(-4), eventDate:mk(55), score:64, budget:2800000, participants:600, urgency:'Basse', contact:'Secrétariat général', converted:false, summary:"Cérémonie de graduation de fin d'année ; sonorisation, scène, gestion de foule.", signals:['Récurrent','Grand public']},
    {id:'op5', org:'CAC Bank Djibouti', type:'Assemblée générale', title:'AG annuelle des actionnaires', source:'Communiqué financier', sourceUrl:'#', found:mk(0), eventDate:mk(33), score:71, budget:3600000, participants:180, urgency:'Moyenne', contact:'Secrétariat de direction', converted:false, summary:"AG annuelle ; salle de conférence, traduction simultanée, captation.", signals:['Institutionnel','Confidentiel']},
    {id:'op6', org:'Chambre de Commerce de Djibouti', type:'Salon professionnel', title:"Salon de l'Entrepreneuriat", source:'Réseau CCD', sourceUrl:'#', found:mk(0), eventDate:mk(60), score:69, budget:7100000, participants:800, urgency:'Moyenne', contact:'Département événements', converted:false, summary:"Salon B2B multi-exposants ; stands, signalétique, programme conférences.", signals:['Multi-exposants','B2B','Sponsors']},
    {id:'op7', org:'Groupe Coubèche', type:'Team building', title:'Séminaire annuel des cadres', source:'LinkedIn public', sourceUrl:'#', found:mk(-1), eventDate:mk(25), score:58, budget:2100000, participants:120, urgency:'Moyenne', contact:'RH', converted:false, summary:"Séminaire interne + team building ; logistique transport, restauration, animation.", signals:['Interne','RH']},
  ].forEach(o=>put('opportunities',o));

  // --- prospects ---
  [
    {id:'pr1', opId:'op1', org:"Ministère de l'Économie et des Finances", contact:'Mme Amina H.', fonction:'Directrice Communication', sector:'Ministère', email:'communication@economie.gouv.dj', phone:'+253 21 35 00 00', wa:'', site:'economie.gouv.dj', address:'Boulevard du Nil, Djibouti', priority:'Très prioritaire', score:88, stage:'prop', owner:'Directeur Commercial', lastContact:mk(-2), nextAction:'Relance J+3', consent:'Intérêt légitime B2B', status:'Envoyé', value:9500000, notes:'Décideur direct identifié. Budget institutionnel confirmé par appel public.', history:[{d:mk(-2),t:'Proposition Premium envoyée après validation DG'}]},
    {id:'pr2', opId:'op2', org:'Djibouti Telecom', contact:'M. Kamil O.', fonction:'Responsable Marketing', sector:'Télécom', email:'marketing@djiboutitelecom.dj', phone:'+253 21 30 12 12', wa:'+253 77 00 00 00', site:'djiboutitelecom.dj', address:'Avenue Maréchal Foch', priority:'Très prioritaire', score:81, stage:'nego', owner:'Commercial', lastContact:mk(-1), nextAction:'Envoyer offre révisée', consent:'Contact commercial existant', status:'Négociation', value:6200000, notes:'Négociation sur le volet activation de marque. Demande une remise de 8%.', history:[{d:mk(-4),t:'1er contact validé et envoyé'},{d:mk(-1),t:'Réponse reçue — demande de rendez-vous'}]},
    {id:'pr3', opId:'op3', org:'Ambassade de France', contact:'Service Protocole', fonction:'Chef de protocole', sector:'Ambassade', email:'protocole@ambafrance-dj.org', phone:'+253 21 35 09 63', wa:'', site:'dj.ambafrance.org', address:'45 Boulevard du Maréchal Joffre', priority:'Prioritaire', score:76, stage:'qualif', owner:'Directeur Commercial', lastContact:mk(-3), nextAction:'Préparer 1er contact', consent:'À obtenir', status:'À vérifier', value:4800000, notes:'Événement récurrent — historique probablement chez un concurrent.', history:[]},
    {id:'pr4', opId:'op5', org:'CAC Bank Djibouti', contact:'M. Idriss A.', fonction:'Secrétaire de direction', sector:'Banque', email:'direction@cacbank.dj', phone:'+253 21 25 11 00', wa:'', site:'cacbank.dj', address:'Place Lagarde', priority:'Prioritaire', score:71, stage:'contact', owner:'Commercial', lastContact:mk(0), nextAction:'Attendre réponse', consent:'Intérêt légitime B2B', status:'Envoyé', value:3600000, notes:'AG confidentielle — insister sur discrétion et traduction simultanée.', history:[{d:mk(0),t:'Email de prise de contact validé et envoyé'}]},
    {id:'pr5', opId:'op6', org:'Chambre de Commerce de Djibouti', contact:'Mme Fatouma D.', fonction:'Resp. Événements', sector:'Institution publique', email:'events@ccd.dj', phone:'+253 21 35 10 70', wa:'', site:'ccd.dj', address:'Place Lagarde', priority:'À développer', score:69, stage:'qualif', owner:'Directeur Commercial', lastContact:mk(-1), nextAction:'Qualifier le budget', consent:'À obtenir', status:'À vérifier', value:7100000, notes:'Gros potentiel récurrent (salon annuel).', history:[]},
    {id:'pr6', opId:'op7', org:'Groupe Coubèche', contact:'Mme Sahra M.', fonction:'DRH', sector:'Industrie', email:'rh@coubeche.dj', phone:'+253 21 34 00 00', wa:'', site:'#', address:'Zone Industrielle', priority:'À surveiller', score:58, stage:'detect', owner:'—', lastContact:null, nextAction:'Enrichir contact', consent:'À obtenir', status:'Brouillon IA', value:2100000, notes:'Contact RH indirect — chercher décideur.', history:[]},
  ].forEach(o=>put('prospects',o));

  // --- proposals ---
  [
    {id:'prop1', prospectId:'pr1', title:"Forum National sur l'Investissement — Proposition Premium", tier:'Premium', lang:'Français', tone:'Institutionnel', value:9500000, margin:26, status:'Envoyé', createdBy:'Agent Writing', validatedBy:'Directeur Général', validatedAt:mk(-2), sentAt:mk(-2)},
    {id:'prop2', prospectId:'pr2', title:'Lancement Fibre 5G — Proposition Professionnelle', tier:'Professionnelle', lang:'Français', tone:'Commercial', value:6200000, margin:24, status:'Négociation', createdBy:'Agent Writing', validatedBy:'Directeur Commercial', validatedAt:mk(-4), sentAt:mk(-4)},
    {id:'prop3', prospectId:'pr4', title:'AG CAC Bank — Proposition Essentielle', tier:'Essentielle', lang:'Français', tone:'Formel', value:3600000, margin:23, status:'À vérifier', createdBy:'Agent Writing', validatedBy:null, validatedAt:null, sentAt:null},
  ].forEach(o=>put('proposals',o));

  // --- approvals ---
  [
    {id:'ap1', kind:'Proposition', ref:'AG CAC Bank — Essentielle', prospect:'CAC Bank Djibouti', agent:'Writing + Compliance', preparedBy:'IA', checks:{name:true,contact:true,margin:true,antispam:true,consent:false,legal:true}, status:'À vérifier', created:mk(0), risk:'Consentement à confirmer'},
    {id:'ap2', kind:'Email de relance', ref:'Relance J+3 — Ministère Économie', prospect:"Ministère de l'Économie", agent:'Follow-up + Compliance', preparedBy:'IA', checks:{name:true,contact:true,margin:true,antispam:true,consent:true,legal:true}, status:'Autorisé à envoyer', created:mk(0), risk:'—'},
    {id:'ap3', kind:'Offre révisée', ref:'Remise 8% — Djibouti Telecom', prospect:'Djibouti Telecom', agent:'Negotiation + Compliance', preparedBy:'IA', checks:{name:true,contact:true,margin:false,antispam:true,consent:true,legal:true}, status:'À corriger', created:mk(0), risk:'Marge sous le seuil (18% < 22%)'},
  ].forEach(o=>put('approvals',o));

  // --- events ---
  [
    {id:'ev1', prospectId:'pr1', name:"Forum National sur l'Investissement", type:'Forum', date:mk(28), venue:'Palais du Peuple', participants:400, budget:9500000, spent:0, progress:34, status:'En préparation', tasksDone:11, tasksTotal:32, risks:2, suppliersConfirmed:5, suppliersTotal:9},
    {id:'ev2', prospectId:'pr2', name:'Lancement Fibre 5G', type:'Lancement de produit', date:mk(21), venue:'Djibouti Palace Kempinski', participants:250, budget:6200000, spent:0, progress:18, status:'En préparation', tasksDone:5, tasksTotal:28, risks:1, suppliersConfirmed:2, suppliersTotal:7},
  ].forEach(o=>put('events',o));

  // --- tasks ---
  [
    {id:'t1', eventId:'ev1', name:'Réserver le Palais du Peuple', owner:'Chef de projet', due:mk(5), done:true, phase:'Avant'},
    {id:'t2', eventId:'ev1', name:'Confirmer traiteur protocole', owner:'Event Manager', due:mk(9), done:true, phase:'Avant'},
    {id:'t3', eventId:'ev1', name:'Plan audiovisuel + captation', owner:'Opérateur', due:mk(14), done:false, phase:'Avant'},
    {id:'t4', eventId:'ev1', name:'Signalétique et badges VIP', owner:'Resp. Communication', due:mk(18), done:false, phase:'Avant'},
    {id:'t5', eventId:'ev1', name:'Briefing sécurité jour-J', owner:'Chef de projet', due:mk(27), done:false, phase:'Jour J'},
    {id:'t6', eventId:'ev2', name:'Concept activation de marque', owner:'Event Manager', due:mk(6), done:true, phase:'Avant'},
    {id:'t7', eventId:'ev2', name:'Réserver la salle Kempinski', owner:'Chef de projet', due:mk(8), done:false, phase:'Avant'},
  ].forEach(o=>put('tasks',o));

  // --- audit + agent log ---
  [
    {id:'a1', d:mk(-2), who:'Directeur Général', act:'Validation', obj:'Proposition Premium — Ministère Économie', detail:'Validé et autorisé à envoyer'},
    {id:'a2', d:mk(-2), who:'Agent Outreach', act:'Envoi', obj:'Email + PDF — Ministère Économie', detail:'Envoyé après validation humaine'},
    {id:'a3', d:mk(-1), who:'Agent Follow-up', act:'Détection', obj:'Réponse — Djibouti Telecom', detail:'Séquence de relance suspendue'},
    {id:'a4', d:mk(0), who:'Agent Compliance', act:'Blocage', obj:'Offre révisée — Djibouti Telecom', detail:'Marge sous le seuil, envoi bloqué'},
  ].forEach(o=>put('audit',o));
  [
    {id:'g1', d:mk(0), agent:'Opportunity Intelligence', msg:'3 nouvelles opportunités détectées, 2 doublons éliminés'},
    {id:'g2', d:mk(0), agent:'Supervisor', msg:'Priorisation : 2 prospects "Très prioritaires" escaladés au Directeur Commercial'},
    {id:'g3', d:mk(0), agent:'Finance', msg:'Alerte : marge offre révisée Djibouti Telecom sous le seuil de 22%'},
    {id:'g4', d:mk(-1), agent:'Lead Research', msg:'Enrichissement de 4 fiches prospects (décideurs + secteur)'},
  ].forEach(o=>put('agentLog',o));

  setKv('seeded', true);
  console.log('✓ Base de données initialisée (données de démo + 5 comptes)');
}

module.exports = { db, COLLECTIONS, putDoc, removeDoc, getCollection, fullState, setKv, getKvVal,
  createUser, verifyUser, listUsers, findUser, seedIfEmpty, now };
