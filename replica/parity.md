# Rapport de parité : clone de planification vs Calendly (web)

Date : 2026-10-19   Build : `main` (`c088b06`)   Outil : `replica-diff/parity.py` sur `replica/features.csv`   (deuxième rapport ; le premier était à 78 avant Google Agenda)

**Verdict : pas livrable.** Trois indispensables ne sont pas faits : e-mails (envoi réel non vérifié), connexion d'un calendrier (Google, non vérifié avec le vrai Google), connexion par Google (pas construite). Aucun bug S1 ou S2 ouvert : 13 bugs trouvés en deux passes de test, 13 corrigés (`replica/bugs.md`).

## Ce qui a changé depuis le premier rapport

| | 1er rapport | maintenant |
| --- | --- | --- |
| Score fonctionnel | 78 | **78** |
| Indispensables faits | 10 sur 12 | **9 sur 12** |
| Google Agenda | absent | construit, testé contre un faux Google, **non vérifié avec le vrai** (ligne « partielle ») |
| Bugs ouverts S1 / S2 | 0 / 0 | 0 / 0 (13 corrigés au total) |
| Tests | 54 + 81 parcours | 95 + 113 parcours (dont 38 + 32 sur Google) |

**Le score n'a pas bougé, et c'est volontaire** : après la construction de Google Agenda il était à 81. En relisant la matrice, j'ai constaté que je traitais deux intégrations externes de façon inégale : « partielle » pour Google (non vérifié avec le vrai service), « faite » pour les e-mails (envoi réel via Resend non vérifié non plus). J'applique maintenant une seule règle : **une intégration externe non vérifiée avec le vrai service compte pour moitié.** Les e-mails repassent donc en « partiel » : 81 → 78. Ce n'est pas une régression du produit, c'est une correction de ma notation.

## Ce que ce score mesure, et ce qu'il ne mesure pas

- **Score fonctionnel : 78 sur 100, par rapport à la matrice** (22 lignes comptées). La matrice a été établie **sans accès à l'application d'origine** (`calendly.com` injoignable ; voir `recon.md`) : le dénominateur est probablement incomplet. Lire « 78 % de ce que nous avons listé », pas « 78 % de Calendly ».
- **Score de mise en page : non mesuré.** `replica/screens/` est toujours vide : aucune capture de l'original à comparer. Les captures du clone existent (`replica/clone-screens/`, dont S02 dans cinq états). Rien n'est inventé.
- **Écarts de comportement** : le côté clone est mesuré, le côté original est à vérifier (voir plus bas).

## Score fonctionnel

## Score global : 78.0 / 100

features 78.0  (22 counted, must-haves 9 of 12 done)

Not shippable yet: 3 must-have features are not done.

## By area, weakest first
- integrations                   0.0  (1 features)
- teams                          0.0  (1 features)
- payments                       0.0  (1 features)
- notifications                 37.5  (2 features)
- onboarding                    50.0  (2 features)
- event types                   75.0  (2 features)
- scheduling rules              85.7  (3 features)
- booking                       96.7  (6 features)
- availability                 100.0  (3 features)
- dashboard                    100.0  (1 features)

## Missing, in build order
- [must] notifications: E-mails de confirmation et rappel, partial  (Confirmation invité, notification hôte, annulation, rappel 24 h : code complet, testé via la boîte d'envoi locale et une API Resend simulée. NON vérifié avec un vrai envoi (domaine, SPF/DKIM, arrivée en boîte de réception) : passe à « yes » après un envoi réel)
- [must] onboarding: Connexion d'un calendrier (lecture occupé), partial  (Google Agenda : lecture des plages occupées + écriture et suppression des réservations, écran S02, révocation gérée. Testé contre un FAUX Google ; non vérifié avec le vrai Google (à faire avec vos identifiants). Outlook et agendas multiples absents)
- [must] onboarding: Inscription par e-mail ou Google, partial  (E-mail + mot de passe : vérification, connexion, réinitialisation, suppression de compte. Connexion Google non faite)
- [should] scheduling rules: Limites par jour/semaine/mois, partial  (Par jour et par semaine, réglables ; par mois manquant)
- [could] event types: Types Group / Collective / Round robin, no  (Collective et round robin probablement payants)
- [could] integrations: Webhooks (créé/annulé), no
- [could] notifications: Workflows (rappels et suivis), no  (Plans payants)
- [could] payments: Paiement à la réservation, no  (À vérifier)
- [could] teams: Formulaires de routage, no  (Plan Teams)
- [could] booking: Page de confirmation personnalisée ou redirection, partial  (Redirection https vers une adresse choisie ; page de confirmation personnalisable manquante)

## Left out on purpose (not scored)
- SSO / administration d'équipe: Hors périmètre : entreprise, hors cible de ce clone
- Réseau d'utilisateurs et marque Calendly: Non clonable : le réseau, la marque et les contenus appartiennent à l'original

## Ce que chaque étape rapporterait (calculé avec l'outil)

| Étape | Score | Indispensables faits |
| --- | --- | --- |
| Maintenant | 78 | 9 sur 12 |
| + un envoi d'e-mail réel vérifié (clé Resend, domaine, arrivée en boîte) | 81 | 10 sur 12 |
| + Google Agenda vérifié avec votre compte | 84 | 11 sur 12 |
| + connexion par Google | **87** | **12 sur 12** → seuil « livrable » atteint (tous les indispensables, score au moins 80, aucun S1/S2 ouvert) |
| + limite mensuelle | 89 | 12 sur 12 |

Deux de ces trois étapes ne demandent presque pas de code : elles demandent **vos identifiants** et un essai réel.


## Écarts de comportement

Côté clone : mesuré (tests, `replica/test-plan.md`). Côté original : **à vérifier** avec votre propre compte ; je n'ai pas pu l'utiliser.

| Flux | Original (non vérifié) | Clone (mesuré) | À faire |
| --- | --- | --- | --- |
| Réservation par l'invité | 4 clics estimés dans la recon | 3 clics (jour, heure, confirmer) + 2 champs | comparer sur le vrai produit |
| Créneau pris pendant la saisie | inconnu | message clair, liste mise à jour, jamais de double réservation (10 réservations simultanées : une seule réussit, avec ou sans agenda Google) | comparer |
| Événement ajouté dans l'agenda pendant la saisie | l'original lit vos calendriers connectés (source tierce) | détecté au contrôle final sans cache ; la réservation est refusée avec un message clair | comparer le délai de prise en compte |
| Agenda externe indisponible | inconnu | page publique rapide (lecture limitée à 2,5 s) ; au moment de réserver, refus propre en cas de panne temporaire de Google ; en cas d'accès retiré ou d'erreur durable, l'hôte est prévenu par e-mail et les réservations continuent | comparer ; choix à valider par vous (voir `backend.md`) |
| Annulation / replanification | inconnu | lien dans l'e-mail, motif, replanification avec coordonnées préremplies ; l'événement Google est supprimé ou remplacé | comparer |
| Calendriers pris en charge | Google, Outlook, iCloud… (source tierce) | **Google seulement**, agenda principal | écart réel : Outlook, plusieurs agendas |
| E-mails | confirmation, rappels, workflows (source tierce) | confirmation, notification hôte, annulation, rappel 24 h ; pas de workflows | envoi réel à vérifier |

À garder : moins de clics que l'estimation de l'original (si elle se confirme) ; fuseaux et heure d'été testés ; protections (limites de débit, jetons chiffrés, accès cloisonné) que l'original ne documente pas dans nos sources.

## À construire ensuite (par valeur)

1. **Essai réel de Google Agenda avec votre compte** (en mode « test » du projet Google, sans vérification) : +3 points, et c'est la seule façon de valider ce qui n'a été testé que contre mon faux serveur (noms de portées, réponses, consentement). Lancer en parallèle la **vérification OAuth de Google (plusieurs semaines)** avant d'ouvrir à d'autres utilisateurs.
2. **Un envoi d'e-mail réel** (clé Resend, domaine vérifié, SPF/DKIM) : +3 points.
3. **Connexion par Google** (indispensable) : +3 points, et atteint le seuil « livrable ». S'appuie sur le même projet OAuth que le point 1 ; demande de régler la fusion avec un compte existant et l'adresse non vérifiée.
4. **Limite mensuelle** (souhaitable) : +2 points, petit : le moteur gère déjà jour et semaine.
5. **Vérifier l'original** : captures de votre propre compte Calendly (cinq écrans suffisent) pour obtenir le score de mise en page, et un passage à la main pour corriger la matrice.

Hors score mais nécessaire avant le lancement : page de confidentialité (exigée aussi par la vérification Google), passe manuelle listée dans `test-plan.md`.

## Suite

`/replica-build` pour la connexion par Google et la limite mensuelle, dès que vous avez les identifiants pour les points 1 et 2. Ou `/replica-entrepreneur` une fois la parité atteinte. Pour un score de mise en page : déposez les captures dans `replica/screens/` (S03.png, S05.png, S06.png, S08.png, S10.png, au format 1440×900 et 390×844).
