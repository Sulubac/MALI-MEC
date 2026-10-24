// Configuration PM2 — maintient l'application en ligne 24/7 et la relance au reboot.
// Démarrage :  pm2 start ecosystem.config.js  &&  pm2 save
module.exports = {
  apps: [{
    name: 'djevent',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    max_memory_restart: '400M',
    env: {
      NODE_ENV: 'production',
      PORT: 4300,          // port interne (Nginx fait le pont vers djevent.techiftiin.online)
      NO_OPEN: '1'         // pas d'ouverture de navigateur côté serveur
      // JWT_SECRET et ANTHROPIC_API_KEY sont lus depuis le fichier .env (voir .env.example)
    }
  }]
};
