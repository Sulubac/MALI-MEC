/* ------------------------------------------------------------------
   useradmin.js — gérer les comptes depuis le serveur (sans passer par l'app).
   À lancer depuis le dossier « platform » :
     node tools/useradmin.js list
     node tools/useradmin.js reset <email> <nouveau_mot_de_passe>
   Résout DB_PATH depuis .env (sinon ./data.sqlite). N'affiche jamais les hash.
   ------------------------------------------------------------------ */
const fs = require('fs');
const path = require('path');

// Lecture minimale de .env pour trouver DB_PATH uniquement (ignore le reste sans risque).
let dbPath = process.env.DB_PATH;
try {
  const envTxt = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const line of envTxt.split('\n')) {
    const m = line.match(/^\s*DB_PATH\s*=\s*(.+?)\s*$/);
    if (m) dbPath = m[1].replace(/^["']|["']$/g, '').trim();
  }
} catch (e) { /* pas de .env : on utilisera le défaut */ }
if (!dbPath) dbPath = path.join(__dirname, '..', 'data.sqlite');

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
let db;
try { db = new Database(dbPath); }
catch (e) { console.error('Impossible d\'ouvrir la base: ' + dbPath + '\n' + e.message); process.exit(1); }

const [, , cmd, email, pass] = process.argv;

if (cmd === 'list') {
  const rows = db.prepare('SELECT email, role, role_name, active FROM users ORDER BY created_at').all();
  console.log('Base : ' + dbPath + '\nComptes (' + rows.length + ') :');
  for (const r of rows) {
    console.log('  - ' + r.email + '  [' + r.role + ' / ' + r.role_name + ']' + (r.active ? '' : '  (DÉSACTIVÉ)'));
  }
} else if (cmd === 'reset' && email && pass) {
  if (pass.length < 6) { console.error('Mot de passe trop court (6 caractères minimum).'); process.exit(1); }
  const r = db.prepare('UPDATE users SET pass_hash=?, must_change_pw=0, active=1 WHERE lower(email)=lower(?)')
    .run(bcrypt.hashSync(pass, 10), email);
  if (r.changes) console.log('✅ OK — mot de passe de « ' + email + ' » réinitialisé. Le compte est actif.');
  else console.log('❌ Email introuvable : « ' + email + ' ». Lancez « node tools/useradmin.js list » pour voir les comptes.');
} else {
  console.log('Usage :\n  node tools/useradmin.js list\n  node tools/useradmin.js reset <email> <nouveau_mot_de_passe>');
}
