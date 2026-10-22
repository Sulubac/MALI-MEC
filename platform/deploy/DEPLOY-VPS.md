# Déploiement sur le VPS — djevent.techiftiin.online

Guide pas-à-pas pour mettre l'application **en ligne pour toute l'équipe** sur votre VPS
Hostinger (`195.35.3.9`, Ubuntu + Node 20 + Nginx + PM2 déjà installés).

> Port interne utilisé : **4300** (les ports 3000 et 8000 sont déjà pris par d'autres apps — on n'y touche pas).
> Toutes les commandes se lancent **sur le VPS** (connecté en SSH : `ssh root@195.35.3.9`).

---

## Étape 1 — Récupérer le code sur le VPS

**Option A — git (recommandé, facile à mettre à jour)**
```bash
cd /root
git clone -b claude/djibouti-event-ai-platform-9bc5r0 https://github.com/Sulubac/MALI-MEC.git djevent-app
cd djevent-app/platform
```
> Si le dépôt est privé, git demandera votre identifiant GitHub + un **token** (Personal Access Token : GitHub → Settings → Developer settings → Tokens). Pour mettre à jour plus tard : `git pull`.

**Option B — sans git (upload du dossier)**
Depuis votre Mac, envoyez le dossier `platform/` :
```bash
scp -r platform root@195.35.3.9:/root/djevent-app
```
Puis sur le VPS : `cd /root/djevent-app`

---

## Étape 2 — Installer et démarrer l'application
```bash
bash deploy/setup.sh
```
Ce script : installe les dépendances, crée un `.env` (avec un `JWT_SECRET` aléatoire), installe PM2 si besoin, et démarre l'app sur le port **4300**.

Vérifiez qu'elle répond :
```bash
curl -s http://127.0.0.1:4300/api/health
```
→ doit afficher `{"ok":true,...}`

Pour que l'app redémarre automatiquement après un reboot :
```bash
pm2 startup systemd -u root --hp /root    # exécutez la commande que PM2 affiche
pm2 save
```

---

## Étape 3 — Publier sur djevent.techiftiin.online (Nginx)

Vérifiez d'abord si un bloc existe déjà pour ce sous-domaine :
```bash
grep -rl "djevent.techiftiin.online" /etc/nginx/ 2>/dev/null
```

- **S'il n'y a RIEN** → créez le bloc :
```bash
cp deploy/nginx-djevent.conf /etc/nginx/sites-available/djevent.techiftiin.online
ln -s /etc/nginx/sites-available/djevent.techiftiin.online /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

- **S'il existe déjà** (il pointe sûrement vers une page par défaut ou l'app `/root/truc`) :
  éditez ce fichier et faites pointer le `location /` vers `http://127.0.0.1:4300;` (copiez le bloc `location` de `deploy/nginx-djevent.conf`), puis `nginx -t && systemctl reload nginx`.

---

## Étape 4 — HTTPS (certificat gratuit)

Si certbot est installé :
```bash
certbot --nginx -d djevent.techiftiin.online
```
Sinon :
```bash
apt update && apt install -y certbot python3-certbot-nginx
certbot --nginx -d djevent.techiftiin.online
```
> Prérequis : l'enregistrement DNS **A** de `djevent.techiftiin.online` doit pointer vers **195.35.3.9** (dans votre zone DNS Hostinger). C'est déjà le cas si l'adresse s'ouvre dans un navigateur.

---

## Étape 5 — Tester
Ouvrez **https://djevent.techiftiin.online** → écran de connexion de la plateforme.

**Première connexion (Super administrateur) :**
`admin@djib-events.dj` · mot de passe `demo1234` → **changez-le immédiatement**.

> ℹ️ La **version serveur** applique les rôles côté serveur (sécurité réelle). Le module
> « créer les comptes de l'équipe depuis l'interface » (comme dans le fichier HTML) est
> la prochaine amélioration prévue — voir avec votre prestataire / la suite du projet.

---

## Commandes utiles (PM2)
```bash
pm2 status            # état des applications
pm2 logs djevent      # journaux en direct
pm2 reload djevent    # recharger après une mise à jour (git pull)
pm2 restart djevent   # redémarrer
```

## Mettre à jour l'application plus tard
```bash
cd /root/djevent-app && git pull
cd platform && npm install --omit=dev && pm2 reload djevent
```

## Sauvegarde des données
Toutes les données de l'équipe sont dans **`platform/data.sqlite`**. Pour sauvegarder :
```bash
cp /root/djevent-app/platform/data.sqlite ~/sauvegarde-djevent-$(date +%F).sqlite
```

## Activer les agents IA réels (optionnel)
Ajoutez votre clé dans `.env` puis rechargez :
```bash
echo 'ANTHROPIC_API_KEY=sk-ant-votre-cle' >> .env
pm2 reload djevent
```
La clé reste **côté serveur**, jamais envoyée au navigateur.
