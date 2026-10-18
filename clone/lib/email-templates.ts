// Textes des e-mails, écrits pour ce produit. Texte brut : lisible partout et sans risque d'injection HTML.
import type { Booking, EventType, Host } from "./types.ts";

type Ctx = { booking: Booking; eventType: EventType; host: Host; baseUrl: (path: string) => string };

const when = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));

const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim(); // jamais de saut de ligne dans un objet

export function verifyEmail(link: string) {
  return {
    subject: "Confirmez votre adresse e-mail",
    text: `Bonjour,\n\nPour activer votre compte, confirmez votre adresse e-mail :\n${link}\n\nCe lien est valable 24 heures. Si vous n'avez pas créé de compte, ignorez ce message.\n`,
  };
}

export function accountExists(resetLink: string) {
  return {
    subject: "Un compte existe déjà avec cette adresse",
    text: `Bonjour,\n\nQuelqu'un a tenté de créer un compte avec cette adresse, mais elle en a déjà un.\nSi c'était vous, vous pouvez choisir un nouveau mot de passe ici :\n${resetLink}\n\nSinon, ignorez ce message : rien n'a changé.\n`,
  };
}

export function resetPassword(link: string) {
  return {
    subject: "Choisissez un nouveau mot de passe",
    text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien :\n${link}\n\nIl est valable 1 heure et ne sert qu'une fois. Vos sessions ouvertes seront fermées après le changement. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n`,
  };
}

export function bookingConfirmation({ booking: b, eventType: e, host: h, baseUrl }: Ctx) {
  return {
    subject: clean(`Rendez-vous confirmé : ${e.name} avec ${h.displayName}`),
    text: `Bonjour ${clean(b.guestName)},\n\nVotre rendez-vous est confirmé.\n\n${e.name}\nAvec : ${h.displayName}\nQuand : ${when(b.startAt, b.guestTimezone)}\nDurée : ${e.durationMinutes} minutes\n\nPour l'ajouter à votre agenda, l'annuler ou choisir un autre créneau :\n${baseUrl(`/booking/${b.manageToken}`)}\n`,
  };
}

export function hostNotification({ booking: b, eventType: e, host: h, baseUrl }: Ctx) {
  return {
    subject: clean(`Nouvelle réservation : ${b.guestName} — ${e.name}`),
    text: `Bonjour ${clean(h.displayName)},\n\n${clean(b.guestName)} (${clean(b.guestEmail)}) a réservé « ${e.name} ».\nQuand : ${when(b.startAt, h.timezone)}\n\nToutes vos réunions : ${baseUrl("/bookings")}\n`,
  };
}

export function bookingReminder({ booking: b, eventType: e, host: h, baseUrl }: Ctx) {
  return {
    subject: clean(`Rappel : ${e.name} demain avec ${h.displayName}`),
    text: `Bonjour ${clean(b.guestName)},\n\nPetit rappel de votre rendez-vous :\n\n${e.name}\nQuand : ${when(b.startAt, b.guestTimezone)}\n\nUn imprévu ? Annulez ou changez de créneau ici :\n${baseUrl(`/booking/${b.manageToken}`)}\n`,
  };
}

export function bookingCancelled({ booking: b, eventType: e, host: h, baseUrl }: Ctx, audience: "guest" | "host") {
  const by = b.cancelledBy === "host" ? h.displayName : b.guestName;
  const reason = b.cancelReason ? `\nMotif : ${clean(b.cancelReason)}\n` : "";
  if (audience === "guest") {
    return {
      subject: clean(`Rendez-vous annulé : ${e.name}`),
      text: `Bonjour ${clean(b.guestName)},\n\nLe rendez-vous « ${e.name} » du ${when(b.startAt, b.guestTimezone)} est annulé (par ${clean(by)}).${reason}\nPour reprendre rendez-vous : ${baseUrl(`/${h.username}/`)}\n`,
    };
  }
  return {
    subject: clean(`Réservation annulée : ${b.guestName} — ${e.name}`),
    text: `Bonjour ${clean(h.displayName)},\n\nLa réunion « ${e.name} » avec ${clean(b.guestName)} du ${when(b.startAt, h.timezone)} est annulée (par ${clean(by)}).${reason}\nToutes vos réunions : ${baseUrl("/bookings")}\n`,
  };
}
