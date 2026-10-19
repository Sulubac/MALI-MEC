# Plan de test : Planifier (clone de planification)

Build : bcddb6c (deuxième passe après Google Agenda)   Date : 2026-10-18   Env : local, Postgres 16 jetable, serveur de production (`next start`), Chromium (Playwright 1.56)

Le plan suit les flux de `replica/recon.md` (F01 à F04), plus deux blocs transverses (comptes et sécurité, e-mails). Chaque ligne est un test automatisé dans `clone/e2e/`. Les colonnes « steps » et « expected » du modèle sont fondues dans « cas » : le titre du test dit l'action, puis le résultat attendu. Contrôles ajoutés à **chaque** test : échec sur une erreur JavaScript de page, une erreur de console ou une réponse 5xx (hors 4xx attendus dans les cas négatifs).

Résultat : **113 réussis sur 113** à la dernière exécution complète (115 tests au total avec deux captures visuelles non bloquantes). Tests unitaires et base : 95 sur 95 (dont 38 sur Google : client, OAuth, plages occupées, écriture, révocation, concurrence, changement d'heure) (`npm test`). Voir « Stabilité » : une exécution intermédiaire a échoué à cause d'un test, corrigé ensuite.

| case | flow | type | cas | auto | result |
| --- | --- | --- | --- | --- | --- |
| F01-H1 | F01 l'hôte met en place son lien | nominal | parcours complet : inscription, confirmation, connexion, type, lien public | e2e | réussi |
| F01-H2 | F01 l'hôte met en place son lien | nominal | modifier un type garde son lien et met à jour la page publique | e2e | réussi |
| F01-H3 | F01 l'hôte met en place son lien | nominal | plages hebdomadaires : un seul jour ouvré avec une plage → seuls ces jours sont réservables | e2e | réussi |
| F01-H4 | F01 l'hôte met en place son lien | nominal | exception : un jour indisponible n'est plus réservable | e2e | réussi |
| F01-H5 | F01 l'hôte met en place son lien | nominal | changer de fuseau décale les créneaux proposés | e2e | réussi |
| F01-E1 | F01 l'hôte met en place son lien | limite | nom : vide refusé, 80 caractères acceptés, saisie conservée après erreur | e2e | réussi |
| F01-E2 | F01 l'hôte met en place son lien | limite | accents et emoji : le nom est conservé, le lien est propre | e2e | réussi |
| F01-E3 | F01 l'hôte met en place son lien | limite | deux types au même nom obtiennent deux liens distincts | e2e | réussi |
| F01-E4 | F01 l'hôte met en place son lien | limite | règles : valeurs conservées au rechargement ; limite semaine < jour refusée sans perdre la saisie | e2e | réussi |
| F01-E5 | F01 l'hôte met en place son lien | limite | suppression : refusée avec réservations, acceptée sans, lien public ensuite en 404 | e2e | réussi |
| F01-E6 | F01 l'hôte met en place son lien | limite | type inactif : absent de la page publique et en 404 ; réactivé, il revient | e2e | réussi |
| F01-E7 | F01 l'hôte met en place son lien | limite | aucun jour ouvré : la page publique affiche un état vide | e2e | réussi |
| F01-E8 | F01 l'hôte met en place son lien | limite | questions : liste à choix avec une seule option refusée, saisie conservée | e2e | réussi |
| F01-N1 | F01 l'hôte met en place son lien | négatif | inscription : mot de passe faible, nom pris, nom réservé, e-mail invalide | e2e | réussi |
| F01-E9 | F01 l'hôte met en place son lien | limite | mot de passe : 128 caractères acceptés, 129 refusés, Unicode accepté | e2e | réussi |
| F01-A | F01 l'hôte met en place son lien | accessibilité | accessibilité des écrans de l'hôte | e2e | réussi |
| F02-H1 | F02 l'invité réserve | nominal | parcours nominal : confirmation, réservation visible côté hôte, e-mails | e2e | réussi |
| F02-H2 | F02 l'invité réserve | nominal | invité dans un autre fuseau : heures affichées dans son fuseau, stockées en UTC | e2e | réussi |
| F02-E1 | F02 l'invité réserve | limite | créneau pris pendant la saisie : message clair, autre créneau possible, jamais de double réservation | e2e | réussi |
| F02-E2 | F02 l'invité réserve | limite | double clic sur « Confirmer » : une seule réservation | e2e | réussi |
| F02-E3 | F02 l'invité réserve | limite | deux onglets du même invité sur le même créneau : une réservation, l'autre refusée | e2e | réussi |
| F02-E4 | F02 l'invité réserve | limite | contenu hostile : nom avec balises affiché tel quel, jamais interprété | e2e | réussi |
| F02-E5 | F02 l'invité réserve | limite | accents, emoji, adresse avec « + » et nom de 120 caractères | e2e | réussi |
| F02-E6 | F02 l'invité réserve | limite | rafraîchir au milieu du parcours puis recommencer fonctionne ; retour arrière après confirmation ne duplique rien | e2e | réussi |
| F02-E7 | F02 l'invité réserve | limite | hors connexion : message clair, rien n'est créé, réessayer fonctionne | e2e | réussi |
| F02-E8 | F02 l'invité réserve | limite | réseau lent : bouton occupé, une seule réservation | e2e | réussi |
| F02-E9 | F02 l'invité réserve | limite | questions : obligatoires refusées en gardant la saisie, réponses enregistrées | e2e | réussi |
| F02-E10 | F02 l'invité réserve | limite | redirection personnalisée après la réservation | e2e | réussi |
| F02-E11 | F02 l'invité réserve | limite | préavis de 7 jours : aucun créneau avant | e2e | réussi |
| F02-E12 | F02 l'invité réserve | limite | limite d'un rendez-vous par jour : les autres créneaux du jour disparaissent | e2e | réussi |
| F02-E13 | F02 l'invité réserve | limite | fuseau extrême (UTC+14) : pas de plantage, jours cohérents | e2e | réussi |
| F02-E14 | F02 l'invité réserve | limite | l'invité change de fuseau dans la page : les heures se recalculent | e2e | réussi |
| F02-N1 | F02 l'invité réserve | négatif | coordonnées invalides : messages clairs, aucune réservation | e2e | réussi |
| F02-N2 | F02 l'invité réserve | négatif | liens invalides : hôte inconnu, type inconnu, type inactif → 404 | e2e | réussi |
| F02-N4 | F02 l'invité réserve | négatif | limite de débit : au-delà de 10 réservations par heure pour une même adresse, message clair | e2e | réussi |
| F02-N3 | F02 l'invité réserve | négatif | nom d'utilisateur dans l'URL avec des majuscules : la page s'ouvre | e2e | réussi |
| F02-M | F02 l'invité réserve | mobile (390 px) | parcours complet en 390 px sans débordement | e2e | réussi |
| F02-K | F02 l'invité réserve | clavier seul | parcours au clavier seul | e2e | réussi |
| F02-A | F02 l'invité réserve | accessibilité | accessibilité : accueil de l'hôte, page de réservation, formulaire, confirmation | e2e | réussi |
| F03-H1 | F03 l'invité annule ou replanifie | nominal | annulation avec motif : statut, e-mails aux deux, créneau libéré | e2e | réussi |
| F03-H2 | F03 l'invité annule ou replanifie | nominal | replanification : nouvelle réservation, ancienne annulée, coordonnées préremplies | e2e | réussi |
| F03-E1 | F03 l'invité annule ou replanifie | limite | annulation dans deux onglets : une seule annulation, pas d'e-mails en double | e2e | réussi |
| F03-E2 | F03 l'invité annule ou replanifie | limite | jeton invalide ou tronqué : 404 | e2e | réussi |
| F03-E3 | F03 l'invité annule ou replanifie | limite | réservation annulée : plus de formulaire, proposition de réserver à nouveau | e2e | réussi |
| F03-E4 | F03 l'invité annule ou replanifie | limite | jeton d'un autre hôte dans ?reschedule= : ignoré, réservation normale | e2e | réussi |
| F03-E5 | F03 l'invité annule ou replanifie | limite | fichier d'agenda (.ics) : valide, échappé, 404 une fois annulé | e2e | réussi |
| F03-E6 | F03 l'invité annule ou replanifie | limite | motif hostile : affiché tel quel côté hôte, limité à 500 caractères | e2e | réussi |
| F03-E7 | F03 l'invité annule ou replanifie | limite | réservation passée : plus d'actions d'annulation ni de replanification | e2e | réussi |
| F03-E8 | F03 l'invité annule ou replanifie | limite | annulation tardive : un lien d'annulation tronqué ou rejoué ne plante pas | e2e | réussi |
| F03-A | F03 l'invité annule ou replanifie | accessibilité | accessibilité : page de gestion avant et après annulation | e2e | réussi |
| F04-H1 | F04 l'hôte gère ses réunions | nominal | onglets avec compteurs ; l'hôte annule, la réunion passe dans « Annulées », e-mails envoyés | e2e | réussi |
| F04-E1 | F04 l'hôte gère ses réunions | limite | états vides de chaque onglet | e2e | réussi |
| F04-E2 | F04 l'hôte gère ses réunions | limite | cloisonnement : un autre hôte ne voit, n'ouvre ni n'annule rien | e2e | réussi |
| F04-E3 | F04 l'hôte gère ses réunions | limite | session expirée : les pages protégées renvoient à la connexion, la saisie en cours n'est pas un plantage | e2e | réussi |
| F04-E4 | F04 l'hôte gère ses réunions | limite | déconnexion dans un onglet : l'autre onglet est renvoyé à la connexion au prochain clic | e2e | réussi |
| F04-E6 | F04 l'hôte gère ses réunions | limite | tableau des réunions à 390 px : une adresse e-mail courte reste sur une ligne | e2e | réussi |
| F04-E5 | F04 l'hôte gère ses réunions | limite | nom d'invité très long sans espace : pas de débordement horizontal à 390 px | e2e | réussi |
| F04-E7 | F04 l'hôte gère ses réunions | limite | réunions : cartes empilées sur mobile (sans en-têtes), tableau sur grand écran | e2e | réussi |
| F04-A | F04 l'hôte gère ses réunions | accessibilité | accessibilité de la liste des réunions (cartes et tableau) | e2e | réussi |
| A-H1 | Comptes et sécurité (transverse) | nominal | lien de confirmation : à usage unique, un nouveau lien invalide l'ancien, le simple chargement ne le consomme pas | e2e | réussi |
| A-H2 | Comptes et sécurité (transverse) | nominal | mot de passe oublié : même réponse pour une adresse inconnue, lien unique, sessions coupées | e2e | réussi |
| A-E1 | Comptes et sécurité (transverse) | limite | e-mail saisi avec majuscules et espaces : la connexion fonctionne | e2e | réussi |
| A-E2 | Comptes et sécurité (transverse) | limite | limite de débit : la connexion est bloquée après 8 essais pour une adresse, le message est clair | e2e | réussi |
| A-E3 | Comptes et sécurité (transverse) | limite | inscription avec une adresse déjà inscrite : même écran, un seul compte, courrier explicatif | e2e | réussi |
| A-E4 | Comptes et sécurité (transverse) | limite | cookie de session : HttpOnly, Secure, SameSite=Lax, préfixe __Host- ; absent du JavaScript | e2e | réussi |
| A-E5 | Comptes et sécurité (transverse) | limite | « se déconnecter partout » ferme les autres appareils ; la déconnexion simple n'en ferme qu'un | e2e | réussi |
| A-E6 | Comptes et sécurité (transverse) | limite | suppression de compte : mot de passe exigé, tout est effacé, liens publics en 404 | e2e | réussi |
| A-E7 | Comptes et sécurité (transverse) | limite | la suppression de compte exige la case de confirmation | e2e | réussi |
| A-E8 | Comptes et sécurité (transverse) | limite | en-têtes de sécurité sur les pages | e2e | réussi |
| A-E9 | Comptes et sécurité (transverse) | limite | point d'entrée de la file de tâches : refusé sans secret ou avec un mauvais secret | e2e | réussi |
| A-E10 | Comptes et sécurité (transverse) | limite | pages protégées sans session : redirection vers la connexion | e2e | réussi |
| A-E11 | Comptes et sécurité (transverse) | limite | jetons de vérification et de réinitialisation falsifiés : message d'erreur, jamais de 500 | e2e | réussi |
| A-E12 | Comptes et sécurité (transverse) | limite | une session est refusée si le compte n'est plus vérifié ou si la ligne a expiré | e2e | réussi |
| A-A | Comptes et sécurité (transverse) | accessibilité | accessibilité des écrans d'authentification | e2e | réussi |
| A-T | Comptes et sécurité (transverse) | titres de page | chaque écran a un titre propre (onglets distincts, titre descriptif) | e2e | réussi |
| A-O | Comptes et sécurité (transverse) | hors ligne | connexion hors ligne : message clair, pas d'écran d'erreur, réessayer fonctionne | e2e | réussi |
| E-H1 | E-mails et file de tâches (transverse) | nominal | confirmation : fuseau de l'invité, lien de gestion, durée ; notification à l'hôte dans son fuseau | e2e | réussi |
| E-H2 | E-mails et file de tâches (transverse) | nominal | rappel 24 h avant : pas d'envoi anticipé, un seul envoi même si le planificateur passe deux fois | e2e | réussi |
| E-E1 | E-mails et file de tâches (transverse) | limite | réservation annulée avant le rappel : aucun rappel, seule l'annulation est envoyée | e2e | réussi |
| E-E2 | E-mails et file de tâches (transverse) | limite | une erreur d'envoi est retentée puis visible dans la file, sans bloquer la réservation | e2e | réussi |
| E-E3 | E-mails et file de tâches (transverse) | limite | un invité qui n'a rien réservé ne reçoit rien ; aucune réservation = aucun e-mail | e2e | réussi |
| G-H1 | S02 agenda Google (faux Google) | nominal | connexion complète : état et PKCE en cookie HttpOnly, retour sur la page, compte affiché, réglages par défaut | e2e | réussi |
| G-H2 | S02 agenda Google (faux Google) | nominal | un événement Google retire le créneau chez l'invité | e2e | réussi |
| G-H3 | S02 agenda Google (faux Google) | nominal | réservation : événement créé dans Google (titre, description) ; annulation : événement supprimé | e2e | réussi |
| G-E1 | S02 agenda Google (faux Google) | limite | événement ajouté pendant que l'invité remplit le formulaire : message clair, créneau retiré, aucune réservation | e2e | réussi |
| G-E2 | S02 agenda Google (faux Google) | limite | Google injoignable au moment de confirmer : message, sélection conservée, réessayer fonctionne | e2e | réussi |
| G-E3 | S02 agenda Google (faux Google) | limite | consentement refusé : message clair, rien n'est connecté | e2e | réussi |
| G-E4 | S02 agenda Google (faux Google) | limite | consentement partiel : lecture seule, option d'écriture désactivée et expliquée | e2e | réussi |
| G-E5 | S02 agenda Google (faux Google) | limite | aucune autorisation de lecture accordée : refus explicite | e2e | réussi |
| G-E6 | S02 agenda Google (faux Google) | limite | retour falsifié ou expiré : état invalide refusé, rien n'est enregistré | e2e | réussi |
| G-E7 | S02 agenda Google (faux Google) | limite | retour sans session : renvoi vers la connexion | e2e | réussi |
| G-E8 | S02 agenda Google (faux Google) | limite | pas de jeton de rafraîchissement renvoyé : message dédié | e2e | réussi |
| G-E9 | S02 agenda Google (faux Google) | limite | réglages : décocher la lecture ignore l'agenda, décocher l'écriture n'ajoute plus d'événements | e2e | réussi |
| G-E10 | S02 agenda Google (faux Google) | limite | accès retiré chez Google : bandeau de reconnexion, e-mail, créneaux non filtrés, reconnexion possible | e2e | réussi |
| G-E11 | S02 agenda Google (faux Google) | limite | déconnexion : confirmation, accès révoqué chez Google, retour à l'état initial | e2e | réussi |
| G-E12 | S02 agenda Google (faux Google) | limite | cloisonnement : la connexion d'un hôte est invisible pour un autre | e2e | réussi |
| G-E13 | S02 agenda Google (faux Google) | limite | suppression du compte : l'accès Google est révoqué | e2e | réussi |
| G-E14 | S02 agenda Google (faux Google) | limite | la page exige une session | e2e | réussi |
| G-A | S02 agenda Google (faux Google) | accessibilité | accessibilité et mobile : non connecté, connecté, reconnexion ; 390 px sans débordement | e2e | réussi |
| G2-E1 | S02 agenda Google, passe 2 (faux Google) | limite | Google très lent : la page publique reste réactive (moins de 5 s), les créneaux s'affichent | e2e | réussi |
| G2-E2 | S02 agenda Google, passe 2 (faux Google) | limite | paramètre d'erreur hostile ou inconnu (__proto__, constructor, balises) : aucun message vide ni injecté | e2e | réussi |
| G2-E3 | S02 agenda Google, passe 2 (faux Google) | limite | adresse de compte Google très longue : pas de débordement à 390 px, connecté comme révoqué | e2e | réussi |
| G2-E4 | S02 agenda Google, passe 2 (faux Google) | limite | le cookie d'état d'un autre utilisateur ne sert à rien (lié à l'utilisateur) | e2e | réussi |
| G2-E5 | S02 agenda Google, passe 2 (faux Google) | limite | cookie d'état expiré : refusé | e2e | réussi |
| G2-E6 | S02 agenda Google, passe 2 (faux Google) | limite | rejouer l'adresse de retour après une connexion réussie : refusé, la connexion reste intacte | e2e | réussi |
| G2-E7 | S02 agenda Google, passe 2 (faux Google) | limite | reconnexion avec un autre compte Google : le nouveau compte est affiché et reçoit les événements | e2e | réussi |
| G2-E8 | S02 agenda Google, passe 2 (faux Google) | limite | limite de débit de la connexion : au-delà de 10 essais par heure, message clair | e2e | réussi |
| G2-E9 | S02 agenda Google, passe 2 (faux Google) | limite | l'hôte annule depuis son tableau de bord : l'événement Google est supprimé | e2e | réussi |
| G2-E10 | S02 agenda Google, passe 2 (faux Google) | limite | replanification par l'invité : l'ancien événement disparaît, le nouveau est créé | e2e | réussi |
| G2-E11 | S02 agenda Google, passe 2 (faux Google) | limite | clavier seul : connecter, régler, enregistrer, sans souris | e2e | réussi |
| G2-E12 | S02 agenda Google, passe 2 (faux Google) | limite | enregistrer les réglages hors ligne : message clair, la saisie est conservée | e2e | réussi |
| G2-E13 | S02 agenda Google, passe 2 (faux Google) | limite | le détail technique d'une erreur Google n'est jamais montré à l'utilisateur ni écrit dans les journaux d'erreur HTTP | e2e | réussi |
| G2-A | S02 agenda Google, passe 2 (faux Google) | accessibilité | accessibilité des messages d'erreur et d'état de la page Calendrier | e2e | réussi |

## Listes de contrôle appliquées à chaque flux

Vide, très long (80 à 120 caractères sans espace), accents et emoji, adresse avec « + », contenu hostile (balises HTML), double clic, deux onglets, retour arrière, rafraîchissement en cours de parcours, réseau lent (1,5 s), hors ligne, session expirée, données d'un second utilisateur, fuseaux (Los Angeles, Tokyo, UTC+14), mobile 390 px, clavier seul, accessibilité (axe, WCAG 2.1 AA), limites de débit.

## Stabilité

La première exécution complète a révélé 8 échecs (7 vrais bugs, 1 test instable sur le titre de page). Après correction, deux tests se sont révélés instables **à cause des tests** (attente d'un rafraîchissement de la liste de créneaux ; adresses réutilisées déclenchant la limite de débit lors des répétitions) : corrigés, puis `F02-E1` et `F02-N4` répétés 6 fois sans échec, et une dernière exécution complète entièrement verte. Aucun test n'est ignoré ni désactivé. Le nombre d'exécutions complètes consécutives reste faible : relancer la suite plusieurs fois avant de la considérer comme stable.

## Tests dépendants de l'heure

Trois tests dépendaient de l'heure d'exécution (`F01-H3`, `F01-H5`, `F02-E14` : ils supposaient que le premier créneau du jour n'est pas encore passé). Ils ont échoué ou auraient échoué selon l'heure, ont été rendus déterministes (choix d'une journée située plus loin) et passent. Je n'ai pas pu simuler l'horloge du serveur : les autres tests ne sont pas prouvés indépendants de l'heure à toute heure de la journée.

## Deuxième passe (après Google Agenda)

La suite de référence a d'abord été relancée sur le code de Google Agenda : 100 réussis sur 101, un échec d'accessibilité intermittent (titre de page vide pendant une navigation, déjà vu une fois) **qui est un défaut du test, pas de l'application** : l'analyse est désormais précédée d'une attente de titre. Ensuite 14 cas ont été ajoutés (`G2-…`) et 6 tests d'intégration visant des hypothèses de défauts : 5 hypothèses sur 11 se sont révélées exactes (BUG-009 à 013), trois échecs étaient des erreurs de mes tests (corrigées), les autres cas passent. Cas qui passent sans défaut : réservations simultanées avec agenda connecté (une seule réussit, un seul événement), changement d'heure d'automne, accents, emoji et nom de 120 caractères, annulation par l'hôte, replanification, clavier seul, hors ligne, cookie d'état d'un autre utilisateur ou expiré, rejeu de l'adresse de retour, limite de débit, détail technique d'erreur jamais montré.

## Non automatisé : passe manuelle à faire

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
