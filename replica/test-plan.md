# Plan de test : Planifier (clone de planification)

Build : voir `git log` (cas GS ajoutés avec la connexion par Google, non passés par une passe de test indépendante)   Date : 2026-10-18   Env : local, Postgres 16 jetable, serveur de production (`next start`), Chromium (Playwright 1.56)

Le plan suit les flux de `replica/recon.md` (F01 à F04), plus deux blocs transverses (comptes et sécurité, e-mails). Chaque ligne est un test automatisé dans `clone/e2e/`. Les colonnes « steps » et « expected » du modèle sont fondues dans « cas » : le titre du test dit l'action, puis le résultat attendu. Contrôles ajoutés à **chaque** test : échec sur une erreur JavaScript de page, une erreur de console ou une réponse 5xx (hors 4xx attendus dans les cas négatifs).

Résultat : **0 réussis sur 0** à la dernière exécution complète (3 tests au total avec trois captures visuelles non bloquantes). Tests unitaires et base : 113 sur 113 (dont 51 sur Google : client, OAuth, jeton d'identité, plages occupées, écriture, révocation, concurrence, règles de liaison de comptes) (`npm test`). Voir « Stabilité » : une exécution intermédiaire a échoué à cause d'un test, corrigé ensuite.

| case | flow | type | cas | auto | result |
| --- | --- | --- | --- | --- | --- |


## Listes de contrôle appliquées à chaque flux

Vide, très long (80 à 120 caractères sans espace), accents et emoji, adresse avec « + », contenu hostile (balises HTML), double clic, deux onglets, retour arrière, rafraîchissement en cours de parcours, réseau lent (1,5 s), hors ligne, session expirée, données d'un second utilisateur, fuseaux (Los Angeles, Tokyo, UTC+14), mobile 390 px, clavier seul, accessibilité (axe, WCAG 2.1 AA), limites de débit.

## Stabilité

La première exécution complète a révélé 8 échecs (7 vrais bugs, 1 test instable sur le titre de page). Après correction, deux tests se sont révélés instables **à cause des tests** (attente d'un rafraîchissement de la liste de créneaux ; adresses réutilisées déclenchant la limite de débit lors des répétitions) : corrigés, puis `F02-E1` et `F02-N4` répétés 6 fois sans échec, et une dernière exécution complète entièrement verte. Aucun test n'est ignoré ni désactivé. Le nombre d'exécutions complètes consécutives reste faible : relancer la suite plusieurs fois avant de la considérer comme stable.

## Tests dépendants de l'heure

Trois tests dépendaient de l'heure d'exécution (`F01-H3`, `F01-H5`, `F02-E14` : ils supposaient que le premier créneau du jour n'est pas encore passé). Ils ont échoué ou auraient échoué selon l'heure, ont été rendus déterministes (choix d'une journée située plus loin) et passent. Je n'ai pas pu simuler l'horloge du serveur : les autres tests ne sont pas prouvés indépendants de l'heure à toute heure de la journée.

## Deuxième passe (après Google Agenda)

La suite de référence a d'abord été relancée sur le code de Google Agenda : 100 réussis sur 101, un échec d'accessibilité intermittent (titre de page vide pendant une navigation, déjà vu une fois) **qui est un défaut du test, pas de l'application** : l'analyse est désormais précédée d'une attente de titre. Ensuite 14 cas ont été ajoutés (`G2-…`) et 6 tests d'intégration visant des hypothèses de défauts : Sur ces 20 cas ciblés : 5 ont révélé un défaut (BUG-009 à 013), 2 échecs venaient de mes propres tests (corrigés : relecture de l'adresse de retour, limite de débit), 13 passent sans défaut. Cas qui passent sans défaut : réservations simultanées avec agenda connecté (une seule réussit, un seul événement), changement d'heure d'automne, accents, emoji et nom de 120 caractères, annulation par l'hôte, replanification, clavier seul, hors ligne, cookie d'état d'un autre utilisateur ou expiré, rejeu de l'adresse de retour, limite de débit, détail technique d'erreur jamais montré.

## Connexion par Google : écrit avec la construction, pas encore audité

Les 20 cas `GS-…` ont été écrits en même temps que la fonctionnalité, par la même personne : ils ne remplacent pas une passe de test indépendante (`/replica-test`) qui cherche d'autres défauts. Pendant l'écriture, ils ont déjà révélé un débordement de la page Compte avec une adresse Google très longue (corrigé) ; trois autres échecs venaient de mes tests (comptages sur toute une table, adresse fixe non rejouable).

## Non automatisé : passe manuelle à faire

- [ ] **Connexion par Google avec le vrai Google** : nouvelle inscription, reconnexion, liaison, déliaison, suppression, refus d'une adresse non confirmée ; mêmes réserves que pour l'agenda (faux serveur écrit par moi).
- [ ] **Google Agenda avec le vrai Google** (priorité) : les tests de S02 tournent contre un faux serveur écrit par moi (`clone/e2e/fake-google.ts`), qui reproduit ma lecture de la documentation. Ils prouvent que NOTRE code se comporte bien, pas que Google répond comme prévu. À vérifier avec un compte Google réel : consentement (y compris le refus d'une portée), noms de portées, lecture des plages occupées, création et suppression d'événements, retrait de l'accès depuis le compte Google.

Ces points dépendent de services réels ou d'appareils, et n'ont **pas** été vérifiés :

- [ ] **E-mail réel via Resend** : domaine vérifié (SPF, DKIM), arrivée en boîte de réception et pas en indésirables, rendu dans Gmail, Outlook et Apple Mail, lien cliquable. Les tests utilisent la boîte d'envoi locale et une API simulée.
- [ ] **Fichier .ics** importé dans Google Agenda, Apple Calendrier et Outlook (le format est testé, pas l'import).
- [ ] **Changement d'heure réel** (dernier dimanche de mars et d'octobre) : parcours de réservation une semaine avant, pendant et après, dans le navigateur. Le calcul est testé unitairement.
- [ ] **Lecteur d'écran** (VoiceOver sur iPhone, NVDA sur Windows) sur la page de réservation et le formulaire de connexion. axe ne détecte qu'une partie des problèmes.
- [ ] **iPhone Safari et Chrome Android** : champs date et heure natifs de l'éditeur de disponibilités, majuscule automatique dans l'URL, clavier qui masque le bouton « Confirmer ».
- [ ] **Limites de débit derrière le vrai proxy** : vérifier que `x-forwarded-for` est bien posé par la plateforme (sinon la limite par IP est contournable).
- [ ] **Plusieurs instances du serveur** en parallèle : la concurrence est testée au niveau base, pas sur plusieurs processus applicatifs.
- [ ] **Volume** : liste des réunions avec plus de 1 000 réservations (pas de pagination).
- [ ] **Sauvegarde et restauration** de la base chez l'hébergeur.

## Cas du modèle non applicables

- Carte refusée (Stripe) : pas de paiement dans ce clone.
- Connexion Google / Google Calendar : pas encore construits.
- Aucun test n'a été lancé contre l'application d'origine (règle du skill).
