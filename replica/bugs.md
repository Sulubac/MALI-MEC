# Bugs trouvés

Deux passes de test : la première (BUG-001 à 008) sur l'application avant Google Agenda, la seconde (BUG-009 à 013) sur S02 après sa construction.

Build testé : `b6220e5` (état avant la suite de tests), corrigés dans **b28a833**. Sept bugs sur huit ont été reproduits par un test automatisé qui échouait **avant** le correctif et réussit après (règle « le test d'abord »). Exception : BUG-007, dont le test (`A-T`) a été écrit en même temps que le correctif, après qu'un test d'accessibilité instable eut signalé le titre vide ; il n'a donc jamais été vu en échec. Aucun S1 ouvert.

| ID | gravité | titre | état |
| --- | --- | --- | --- |
| BUG-001 | S3 | Boutons d'édition des disponibilités : nom accessible sans le texte visible | corrigé (b28a833) |
| BUG-002 | S3 | Un nom ou une adresse très long sans espace fait déborder la page | corrigé (b28a833) |
| BUG-003 | S2 | Envoi d'un formulaire sans réseau : erreur non gérée, aucun message | corrigé (b28a833) |
| BUG-004 | S3 | Lien public avec une majuscule : 404 | corrigé (b28a833) |
| BUG-005 | S3 | Fichier .ics : « ; » non échappé et lignes non pliées | corrigé (b28a833) |
| BUG-006 | S4 | E-mail « un compte existe déjà » envoyé à l'adresse telle que saisie | corrigé (b28a833) |
| BUG-007 | S4 | Toutes les pages ont le même titre « Planifier » | corrigé (b28a833) |
| BUG-008 | S3 | Tableau des réunions illisible à 390 px | corrigé (b28a833), refait en cartes (voir ci-dessous) |
| BUG-009 | S3 | Reconnecter Google laisse l'ancien jeton valable chez Google | corrigé (bcddb6c) |
| BUG-010 | S2 | Une erreur durable de Google (400, 401) bloque toutes les réservations de l'hôte | corrigé (bcddb6c) |
| BUG-011 | S3 | Un agenda Google lent fait attendre jusqu'à 6,5 s la page publique | corrigé (bcddb6c) |
| BUG-012 | S4 | `?error=__proto__` affiche un message d'alerte vide | corrigé (bcddb6c) |
| BUG-013 | S3 | Une adresse de compte Google très longue fait déborder la page Calendrier | corrigé (bcddb6c) |

### BUG-001: boutons « Retirer » et « Copier sur lun.–ven. » : le nom accessible ne contient pas le texte visible

- Severity: S3
- Flow / case: F01 / F01-A
- Screen: S06 (disponibilités)
- Build: avant b28a833  Browser / device: Chromium, 1280 px

Steps
1. Se connecter, ouvrir /availability.
2. Analyser la page avec axe (WCAG 2.1 AA).

Expected: aucune violation.
Actual: `label-content-name-mismatch (serious)` : le bouton affiche « Retirer » mais son `aria-label` est « Lundi, supprimer la plage 1 » ; idem « Copier sur lun.–ven. ». Un utilisateur de commande vocale qui dit « cliquer Retirer » n'obtient rien (WCAG 2.5.3).
Evidence: test `F01-A accessibilité des écrans de l'hôte`.
Suspected cause: `aria-label` rédigé sans reprendre le texte du bouton.
Status: fixed in b28a833 (le nom accessible commence par le texte visible).

### BUG-002: un mot très long sans espace fait déborder la page

- Severity: S3
- Flow / case: F02 / F02-E5 ; F04 / F04-E5
- Screen: S10 (confirmation), S03 (liste des types), S12 (réunions)
- Build: avant b28a833  Browser / device: Chromium, 1280 et 390 px

Steps
1. Réserver en saisissant un nom de 106 « N » sans espace (le champ accepte 120 caractères) ; ou créer un type dont le nom contient un mot de 30 lettres.
2. Ouvrir la page de confirmation, puis /event-types sur 390 px.

Expected: le texte se coupe ; pas de barre de défilement horizontale.
Actual: `scrollWidth` > largeur de fenêtre (590 px pour 390 px) : la page défile latéralement.
Evidence: tests `F02-E5` et `F04-E5` ; capture `replica/test-screens/guest-confirmation-390.png`.
Suspected cause: `break-words` ne réduit pas la largeur minimale d'un élément de grille ; il faut `overflow-wrap: anywhere`.
Status: fixed in b28a833 (classe `wrap-anywhere` limitée au contenu saisi par les utilisateurs, voir BUG-008).

### BUG-003: envoi d'un formulaire sans réseau : exception non gérée, aucun message

- Severity: S2
- Flow / case: F02 / F02-E7 ; Auth / A-O
- Screen: S08/S09 (réservation), S01 (connexion) et tous les formulaires
- Build: avant b28a833  Browser / device: Chromium, hors ligne simulé

Steps
1. Ouvrir une page de réservation, choisir un créneau, remplir le formulaire.
2. Passer hors ligne, cliquer « Confirmer ».

Expected: un message explique que le serveur est injoignable, la saisie est conservée, on peut réessayer.
Actual: rien n'est affiché ; erreur JavaScript non interceptée dans la console. Même chose sur la connexion et les formulaires de l'hôte (risque d'écran d'erreur de l'application).
Evidence: tests `F02-E7 hors connexion` et `A-O connexion hors ligne`.
Suspected cause: l'appel à l'action serveur n'était pas entouré d'un `try/catch`.
Status: fixed in b28a833 (message « Impossible de joindre le serveur… », créneau et saisie conservés, redirections de Next laissées passer).

### BUG-004: lien public avec une majuscule : 404

- Severity: S3
- Flow / case: F02 / F02-N3
- Screen: S07, S08
- Build: avant b28a833  Browser / device: tout navigateur

Steps
1. Ouvrir `/Demo/echange-de-30-minutes` (le clavier d'un iPhone met souvent la première lettre en majuscule quand on tape ou colle un lien).

Expected: la page s'ouvre.
Actual: 404 « Page introuvable ». Les noms d'utilisateur et liens sont toujours en minuscules en base.
Evidence: test `F02-N3`.
Status: fixed in b28a833 (paramètres mis en minuscules, y compris dans l'action de réservation).

### BUG-005: fichier .ics : point-virgule non échappé, lignes non pliées

- Severity: S3
- Flow / case: F03 / F03-E5
- Screen: téléchargement « Ajouter à mon agenda »
- Build: avant b28a833

Steps
1. Créer un type nommé « Atelier; virgule, antislash \ » avec un lieu « Salle 3, étage 2 », réserver, télécharger le .ics.

Expected: `SUMMARY:Atelier\; virgule\, antislash \\`, lignes de 75 octets au plus (RFC 5545).
Actual: le point-virgule n'était pas échappé (`"\;"` vaut `";"` en JavaScript) ; aucun pliage des lignes longues.
Evidence: test `F03-E5` + 4 tests unitaires `lib/ics.test.ts`.
Status: fixed in b28a833 (`lib/ics.ts` : échappement, pliage par caractères entiers, fins de ligne CRLF, pas de lieu vide).

### BUG-006: e-mail « un compte existe déjà » envoyé à l'adresse telle que saisie

- Severity: S4
- Flow / case: Auth / A-E3
- Build: avant b28a833

Steps
1. S'inscrire avec `NINA@EXAMPLE.TEST` alors que `nina@example.test` a un compte.

Expected: le message part vers l'adresse enregistrée (forme normalisée).
Actual: il partait vers la forme saisie en majuscules.
Evidence: test `A-E3`.
Status: fixed in b28a833.

### BUG-007: toutes les pages portent le même titre

- Severity: S4
- Flow / case: transverse / A-T (et le test d'accessibilité F02-A, instable à cause du titre vide pendant la navigation)
- Build: avant b28a833

Steps
1. Ouvrir plusieurs pages dans des onglets.

Expected: un titre descriptif par page (« Connexion · Planifier », « Réserver avec … »).
Actual: « Planifier » partout : onglets indiscernables, historique et lecteurs d'écran peu utiles.
Evidence: test `A-T`.
Status: fixed in b28a833.

### BUG-008: tableau des réunions illisible à 390 px

- Severity: S3
- Flow / case: F04 / F04-E5, F04-E6
- Screen: S12
- Build: premier correctif de BUG-002, puis b28a833  Browser / device: Chromium, 390 px

Steps
1. Avoir une réservation avec une adresse courte (`court@example.test`).
2. Ouvrir /bookings à 390 px.

Expected: date lisible, bouton « Annuler » lisible, adresse sur une ligne.
Actual: (a) avec une règle globale `overflow-wrap: anywhere`, la date et « Annuler » s'empilaient lettre par lettre ; (b) même sans cela, les colonnes étroites coupaient `court@exampl e.test`. (a) est une régression introduite par le premier correctif de BUG-002, trouvée à la passe visuelle.
Evidence: `replica/test-screens/host-bookings-390.png`, tests `F04-E5` (géométrie du bouton et lignes de la date) et `F04-E6`.
Status: fixed in b28a833 (règle limitée au contenu utilisateur, tableau à largeur minimale avec défilement interne). Cette solution gardait un défilement horizontal interne et des colonnes serrées : remplacée ensuite par des cartes empilées sous 768 px (tableau au-delà), un seul DOM avec rôles ARIA de tableau. Tests : `F04-E7` (cartes sur mobile, en-têtes sur grand écran, bouton pleine largeur, pas de défilement interne), `F04-A` (axe aux deux largeurs), `F04-E5` et `F04-E6` conservés. Captures : `replica/test-screens/host-bookings-390.png` et `-1280.png`.

### BUG-009: reconnecter Google laisse l'ancien jeton valable chez Google

- Severity: S3 (hygiène de sécurité : un accès à l'agenda qui n'est plus suivi par l'application)
- Flow / case: S02 / test d'intégration « reconnecter révoque l'ancien jeton chez Google »
- Screen: S02
- Build: 73d9781

Steps
1. Connecter un compte Google.
2. Reconnecter (par exemple depuis l'état « reconnexion nécessaire » après une erreur 403, alors que le jeton est encore valable).

Expected: un seul jeton reste actif chez Google.
Actual: le nouveau jeton remplaçait l'ancien en base, mais l'ancien restait valable chez Google, sans que l'application ne puisse plus le révoquer (il n'est plus stocké).
Evidence: test `calendar.test.ts › reconnecter révoque l'ancien jeton chez Google` (2 jetons, 2 valides).
Suspected cause: l'enregistrement de la connexion écrasait la ligne sans révoquer l'ancien jeton.
Status: fixed in bcddb6c (révocation de l'ancien jeton, meilleur effort).

### BUG-010: une erreur durable de Google bloque toutes les réservations de l'hôte

- Severity: S2 (flux principal bloqué pour un hôte ; contournement : déconnecter l'agenda, que ni l'hôte ni l'invité ne devinent)
- Flow / case: F02 / test d'intégration « Google refuse la requête (400, durable) »
- Screen: S08/S09 (réservation)
- Build: 73d9781

Steps
1. Connecter l'agenda d'un hôte.
2. Faire répondre Google 400 (ou 401 après un nouveau jeton) à la lecture des plages occupées.
3. Un invité confirme un créneau.

Expected: la réservation aboutit, l'hôte est prévenu que son agenda ne fonctionne plus (comme pour un 403).
Actual: « Impossible de vérifier l'agenda de l'organisateur » à chaque tentative, indéfiniment : seul le 403 avait été traité comme une erreur durable.
Evidence: test `calendar.test.ts › Google refuse la requête (400, durable)`.
Suspected cause: classement incomplet des erreurs. Les 400 peuvent venir d'une limite de Google que je ne connais pas (par exemple une durée maximale de la plage demandée) ou d'un défaut de notre côté : dans les deux cas, bloquer toutes les réservations est pire que prévenir l'hôte.
Status: fixed in bcddb6c (400, 401 persistant et 403 : connexion marquée « à reconnecter » avec un message précis, e-mail à l'hôte, réservations ouvertes). Seules les pannes temporaires (5xx, 429, délai) refusent encore la réservation.

### BUG-011: un agenda Google lent fait attendre la page publique jusqu'à 6,5 s

- Severity: S3
- Flow / case: F02 / G2-E1
- Screen: S08
- Build: 73d9781

Steps
1. Connecter l'agenda d'un hôte ; faire répondre freeBusy en 9 s.
2. Un invité ouvre la page de réservation.

Expected: la page s'affiche en moins de 5 s, avec les créneaux (le contrôle final se fait à la confirmation).
Actual: 6 513 ms avant l'affichage : la page attendait le délai complet de 6 s.
Evidence: test `G2-E1`.
Status: fixed in bcddb6c (2,5 s pour l'affichage, 6 s inchangé pour le contrôle final à la réservation).

### BUG-012: `?error=__proto__` affiche une alerte vide

- Severity: S4
- Flow / case: S02 / G2-E2
- Screen: S02
- Build: 73d9781

Steps
1. Ouvrir `/integrations?error=__proto__` (ou `constructor`, `toString`).

Expected: aucun message.
Actual: un cadre d'alerte vide (la recherche du message touchait le prototype d'objet).
Evidence: test `G2-E2` ; aucune exécution de script (la valeur n'est jamais affichée).
Status: fixed in bcddb6c (`Object.hasOwn`).

### BUG-013: adresse de compte Google très longue : la page Calendrier déborde

- Severity: S3
- Flow / case: S02 / G2-E3
- Screen: S02, état connecté et état « reconnexion nécessaire »
- Build: 73d9781  Browser / device: Chromium, 390 px

Steps
1. Se connecter avec un compte dont l'adresse fait 100 caractères sans séparateur, ouvrir /integrations à 390 px.

Expected: l'adresse se coupe.
Actual: défilement horizontal de la page.
Evidence: test `G2-E3`.
Status: fixed in bcddb6c (`wrap-anywhere` sur les deux cartes).

## À vérifier (non reproduit ou hors de portée)

- **Tout le comportement face au vrai Google** : les tests utilisent mon faux serveur Google, qui reproduit ma lecture de la documentation. Noms de portées, formes de réponse, consentement partiel, durée de vie des jetons, quotas : non vérifiés.
- **Jetons de rafraîchissement en mode « Test »** : je crois (à confirmer dans la documentation Google) qu'un projet dont l'écran de consentement est en mode « Test » voit les jetons expirer après 7 jours. Si c'est le cas, les hôtes devront reconnecter chaque semaine pendant vos essais ; l'application gère ce cas comme une révocation (bandeau + e-mail).
- **Durée maximale de la plage de `freeBusy`** : l'application demande jusqu'à 368 jours quand l'horizon d'un type est de 365 jours. Je ne sais pas si Google limite cette durée ; si oui, les hôtes à très long horizon verraient l'avertissement de BUG-010 (réservations ouvertes, agenda ignoré).
- Après une annulation, si la suppression de l'événement Google échoue (panne de Google), le créneau reste bloqué côté Google jusqu'à la nouvelle tentative (2 min, puis 4, 8, 16) : limite connue, documentée dans `backend.md`.

### Déjà connus avant cette passe

- Un lien d'annulation connu permet d'annuler une réunion **passée** en appelant directement l'action (l'interface masque le bouton). Conséquence limitée (e-mails « annulé » pour une réunion déjà tenue), signalée dans `backend.md` (« délai limite d'annulation »).
- Liste des réunions sans pagination : comportement avec beaucoup de réservations non mesuré.
- Tout ce qui figure dans « Non automatisé » du plan de test.
