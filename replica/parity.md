# Rapport de parité : clone de planification vs Calendly (web)

Date : 2026-10-19   Build : `main` (après `bookings: stacked cards…`)   Outil : `replica-diff/parity.py` sur `replica/features.csv`

**Verdict : pas livrable.** Deux indispensables ne sont pas faits (connexion d'un calendrier externe ; connexion Google). Aucun bug S1 ou S2 ouvert (`replica/bugs.md`).

## Ce que ce score mesure, et ce qu'il ne mesure pas

- **Score fonctionnel : 78 sur 100, calculé par rapport à la matrice** (22 lignes comptées, 10 indispensables sur 12 faits). La matrice a été établie **sans accès à l'application d'origine** : `calendly.com` était injoignable depuis cet environnement et elle repose sur des extraits de recherche et des blogs (voir `recon.md`, « Limites de cette recon »). Le dénominateur est donc probablement incomplet (aucune ligne pour les sondages de réunion, les liens à usage unique, les widgets intégrables, les extensions de navigateur, etc.). Lire « 78 % de ce que nous avons listé », pas « 78 % de Calendly ».
- **Score de mise en page : non mesuré.** `replica/screens/` est vide : il n'y a aucune capture de l'original à comparer. Les captures du clone existent (`replica/clone-screens/`, `replica/test-screens/`). Rien n'est inventé ici.
- **Différences de comportement : le côté clone est mesuré, le côté original n'est pas vérifié** (voir plus bas).

## Score fonctionnel

## Score global : 78.0 / 100

features 78.0  (22 counted, must-haves 10 of 12 done)

Not shippable yet: 2 must-have features are not done.

## By area, weakest first
- integrations                   0.0  (1 features)
- teams                          0.0  (1 features)
- payments                       0.0  (1 features)
- onboarding                    25.0  (2 features)
- event types                   75.0  (2 features)
- notifications                 75.0  (2 features)
- scheduling rules              85.7  (3 features)
- booking                       96.7  (6 features)
- availability                 100.0  (3 features)
- dashboard                    100.0  (1 features)

## Missing, in build order
- [must] onboarding: Connexion d'un calendrier (lecture occupé), no  (Nécessite OAuth (replica-backend))
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

## Écarts de comportement

Côté clone : mesuré (tests `replica/test-plan.md`). Côté original : **à vérifier** avec votre propre compte, je n'ai pas pu l'utiliser.

| Flux | Original (non vérifié) | Clone (mesuré) | À faire |
| --- | --- | --- | --- |
| Réservation par l'invité | 4 clics estimés dans la recon | 3 clics (jour, heure, confirmer) + 2 champs de texte | comparer sur le vrai produit |
| Création d'un type d'événement | inconnu | 2 clics (« Nouveau type », « Enregistrer ») + 1 champ obligatoire | comparer |
| Créneau pris pendant la saisie | inconnu | message clair, liste mise à jour, créneau désélectionné, jamais de double réservation (testé, y compris 10 réservations simultanées) | comparer |
| Annulation / replanification | inconnu | lien dans l'e-mail ; annulation avec motif ; replanification par un nouveau créneau, coordonnées préremplies | comparer |
| Calendrier externe | l'original lit vos calendriers connectés (source tierce) | **absent** : seuls les créneaux de l'application sont pris en compte, un rendez-vous pris ailleurs ne bloque rien | construire (indispensable) |
| E-mails | confirmation, rappels, workflows (source tierce) | confirmation, notification hôte, annulation, rappel 24 h ; pas de workflows | envoi réel à vérifier avec une clé Resend |

À garder : moins de clics que l'estimation de l'original, si elle se confirme ; fuseaux et heure d'été testés ; limites de débit et protections que l'original ne documente pas dans nos sources.

## À construire ensuite (par valeur)

1. **Connexion d'un calendrier (Google d'abord)** : lecture des plages occupées et écriture des réservations. Indispensable, et c'est le plus gros écart produit : sans lui, un hôte peut être réservé alors qu'il est déjà pris ailleurs. Demande un projet Google Cloud à vous et la **vérification OAuth de Google (des semaines)** : à démarrer maintenant.
2. **Connexion Google** (indispensable) : même projet OAuth que le point 1, donc peu de travail en plus une fois celui-ci en place.
3. **Limite par mois** (souhaitable) : petit, le moteur de créneaux gère déjà jour et semaine.
4. **Page de confirmation personnalisable** (optionnel) : la redirection existe, pas le texte personnalisé.
5. **Vérifier l'original** : captures de votre propre compte Calendly (5 écrans suffisent : types d'événements, éditeur, disponibilités, page de réservation, confirmation) pour obtenir le score de mise en page, et un passage à la main pour corriger la matrice. Sans cela, le score reste une estimation.

Hors score mais nécessaire avant le lancement : envoi d'e-mail réel vérifié, page de confidentialité, passe manuelle listée dans `test-plan.md`.

## Suite

`/replica-build` pour les points 1 à 4, ou `/replica-entrepreneur` une fois la parité atteinte. Pour que `/replica-diff` donne un score de mise en page, déposez les captures dans `replica/screens/` en les nommant comme les écrans (S03.png, S05.png, S06.png, S08.png, S10.png) au format 1440×900 et 390×844.
