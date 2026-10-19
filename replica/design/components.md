# Composants

Source : liste de `replica/recon.md` (déduite, non observée). Les tailles et variantes sont à confirmer sur captures. Icônes : Lucide (MIT). Base accessible : Radix UI / shadcn/ui. Tous les textes sont à écrire à neuf.
Règles communes : focus visible = anneau 2px `accent` décalé de 2px (contraste UI ≥ 3:1) ; cibles tactiles ≥ 44px sur mobile ; jamais d'hex brut, uniquement des classes de rôle.

Button
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 40px, lg 48px
  states    default, hover, active, focus-visible, disabled, loading
  tokens    primary : bg accent, text on-accent ; secondary : bg bg, border border-input, text text ; danger : bg danger, text on-danger ; radius md ; font sm/600
  a11y      vrai <button>, label conservé pendant le chargement (aria-busy), disabled = aria-disabled + raison en texte
  used on   S01, S03, S05, S09, S10, S11

TextField (texte, e-mail, textarea)
  variants  text, email, textarea
  sizes     md 40px
  states    default, hover, focus, filled, error, disabled, readonly
  tokens    border border-input, text text, placeholder text-muted, erreur danger, radius md
  a11y      <label> visible lié, erreur dans aria-describedby (pas seulement la couleur), type et autocomplete corrects
  used on   S01, S05, S09, S11

Select / TimezonePicker
  states    default, open, filtering (recherche), selected, empty result, disabled
  tokens    comme TextField ; liste en surface avec shadow pop
  a11y      combobox ARIA (Radix Select / Combobox), flèches + saisie, fuseau détecté présélectionné et annoncé
  used on   S05, S06, S08

Toggle (activer un type d'événement)
  states    off, on, focus-visible, disabled, loading
  tokens    on = accent, off = border-input
  a11y      role="switch", aria-checked, label visible
  used on   S03, S02 (check_busy)

Calendar (mois)
  variants  mois, mobile (compact)
  states    jour sans créneau (désactivé), jour disponible, jour sélectionné, aujourd'hui, hors mois, chargement, aucun créneau ce mois
  tokens    sélectionné = accent / on-accent, disponible = accent-subtle, désactivé = text-muted
  a11y      grille ARIA, flèches de navigation, aria-label complet de la date ("lundi 3 novembre, 5 créneaux"), mois suivant/précédent au clavier
  used on   S08, S11, S06 (exceptions)

TimeSlotList
  states    default, hover, focus-visible, sélectionné (révèle le bouton de confirmation), indisponible (pris pendant la session), chargement (squelette), vide
  tokens    bordure accent, radius md, text sm/600
  a11y      liste de boutons, heure + fuseau annoncés ; créneau pris = message role="alert" puis nouveau chargement
  used on   S08

EventTypeCard
  variants  actif, inactif, limite de plan atteinte
  states    default, hover, focus-visible, menu ouvert, copié (toast)
  tokens    surface, bande de couleur du type, shadow card, radius lg
  a11y      carte entière non cliquable en conflit avec ses boutons ; actions dans un menu (Radix DropdownMenu) ; "copier le lien" annonce le résultat
  used on   S03, S07

AvailabilityEditor (grille hebdomadaire)
  states    jour désactivé, plages multiples, chevauchement (erreur), copier vers d'autres jours, fuseau modifié
  tokens    comme TextField (heures), danger pour erreurs
  a11y      une ligne par jour avec case à cocher, champs d'heure étiquetés ("lundi, début de plage 1")
  used on   S06

Modal / Dialog
  sizes     sm 400px, md 560px
  states    open, closing, avec erreur, chargement
  tokens    surface, shadow pop, radius lg, overlay noir 40 %
  a11y      Radix Dialog : piégeage du focus, Échap, retour du focus au déclencheur, titre lié
  used on   S04, S11

Toast
  variants  success, error, info
  states    entrée, visible (5 s, pause au survol/focus), sortie
  tokens    surface, shadow pop, icône + texte (couleur jamais seule)
  a11y      role="status" (success/info), role="alert" (error)
  used on   S03 (lien copié), S05 (enregistré), S09 (erreur)

DataTable (réunions planifiées)
  states    chargement, vide, filtré, ligne annulée (barrée + libellé), tri, pagination
  tokens    border, surface en-tête
  a11y      sémantique de tableau conservée via rôles ARIA (table, row, columnheader, cell) ; sous 768px chaque ligne devient une carte empilée (date en tête, invité, type, bouton pleine largeur), sans en-têtes ni défilement horizontal
  used on   S12

SideNav / Header
  states    lien actif (aria-current), réduit sur mobile (menu), focus
  tokens    surface, largeur sidebar 240px, header 56px
  a11y      <nav> étiqueté, lien "aller au contenu", ordre de tabulation logique
  used on   S03, S05, S06, S12, S13

LivePreviewPane (aperçu de la page de réservation dans l'éditeur)
  states    à jour, en cours de mise à jour, erreur de rendu, mobile / bureau
  tokens    bg, border, radius lg
  a11y      iframe titré ; bascule bureau/mobile par boutons étiquetés
  used on   S05

EmptyState
  states    vide (avec action), erreur de chargement (avec réessai), accès refusé
  a11y      titre de niveau cohérent, action principale focalisable
  used on   S03, S08 (aucun créneau), S12, S13

Skeleton
  states    chargement des créneaux, des cartes, du tableau
  a11y      aria-busy sur le conteneur, respect de prefers-reduced-motion
  used on   S03, S08, S12
