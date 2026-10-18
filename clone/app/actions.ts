"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import {
  checkCredentials, deleteAccount, deleteAllSessions, reissueVerification, requestPasswordReset, resetPassword, signUp, verifyEmail,
} from "@/lib/auth-core";
import { clearSessionCookie, clientIp, endSession, requireHost, requireUser, startSession } from "@/lib/auth";
import { appUrl, sendEmail } from "@/lib/email";
import * as T from "@/lib/email-templates";
import { rateLimit } from "@/lib/rate-limit";
import {
  cancelBooking, createBooking, createEventType, deleteEventType, getEventTypeBySlug, getHostByUsername, saveAvailability,
  setEventTypeActive, updateEventType,
} from "@/lib/store";
import { SlotTakenError, SlotUnavailableError } from "@/lib/types";
import { parseAvailability, parseEventTypeForm, parseSignup, validatePassword } from "@/lib/validate";
import { processDueJobs } from "@/lib/worker";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean; unverifiedEmail?: string };

const str = (fd: FormData) => (k: string) => String(fd.get(k) ?? "");
const TOO_MANY = "Trop de tentatives. Réessayez dans quelques minutes.";

/** Vrai si toutes les limites sont respectées. Chaque appel compte, même refusé. */
async function allowed(limits: [key: string, max: number, windowSeconds: number][]): Promise<boolean> {
  let ok = true;
  for (const [k, max, w] of limits) if (!(await rateLimit(k, max, w)).ok) ok = false;
  return ok;
}

/** Envoi après la réponse : n'allonge pas la requête, et un échec est journalisé sans révéler quoi que ce soit à l'utilisateur. */
function mailLater(to: string, mail: { subject: string; text: string }) {
  after(async () => {
    try { await sendEmail({ to, ...mail }); } catch (e) { console.error("e-mail non envoyé :", e instanceof Error ? e.message : e); }
  });
}
function flushJobs() {
  after(async () => { try { await processDueJobs(); } catch (e) { console.error("file de tâches :", e instanceof Error ? e.message : e); } });
}

// ---------- Authentification ----------
export async function signupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = parseSignup(str(fd));
  if (!parsed.ok) return { fieldErrors: parsed.errors };
  const v = parsed.value;
  if (!(await allowed([[`signup:ip:${await clientIp()}`, 10, 3600], [`signup:email:${v.email.toLowerCase()}`, 3, 3600]]))) return { error: TOO_MANY };
  const r = await signUp(v);
  if (r.status === "username_taken") return { fieldErrors: { username: "Ce nom est déjà pris." } };
  // Même réponse que l'adresse soit nouvelle ou déjà inscrite : on ne révèle pas qui a un compte.
  if (r.status === "created") mailLater(v.email, T.verifyEmail(appUrl(`/verify?token=${r.token}`)));
  else {
    const reset = await requestPasswordReset(v.email);
    if (reset) mailLater(v.email, T.accountExists(appUrl(`/reset?token=${reset.token}`)));
  }
  return { saved: true };
}

export async function resendVerificationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd)("email").trim().toLowerCase();
  if (!(await allowed([[`resend:ip:${await clientIp()}`, 10, 3600], [`resend:email:${email}`, 3, 3600]]))) return { error: TOO_MANY };
  const r = await reissueVerification(email);
  if (r) mailLater(email, T.verifyEmail(appUrl(`/verify?token=${r.token}`)));
  return { saved: true };
}

export async function verifyAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await allowed([[`verify:ip:${await clientIp()}`, 20, 3600]]))) return { error: TOO_MANY };
  if (!(await verifyEmail(str(fd)("token")))) return { error: "Ce lien est invalide ou a expiré. Demandez-en un nouveau depuis la page de connexion." };
  redirect("/login?verified=1");
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd)("email").trim().toLowerCase();
  if (!(await allowed([[`login:ip:${await clientIp()}`, 30, 900], [`login:email:${email}`, 8, 900]]))) return { error: TOO_MANY };
  const r = await checkCredentials(email, str(fd)("password"));
  if (r.status === "unverified") return { error: "Cette adresse n'est pas encore confirmée. Ouvrez le lien reçu par e-mail.", unverifiedEmail: email };
  if (r.status !== "ok") return { error: "Adresse ou mot de passe incorrect." };
  await startSession(r.user.id);
  redirect("/event-types");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

export async function logoutEverywhereAction() {
  const user = await requireUser();
  await deleteAllSessions(user.id);
  await clearSessionCookie();
  redirect("/login");
}

export async function forgotAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd)("email").trim().toLowerCase();
  if (!(await allowed([[`forgot:ip:${await clientIp()}`, 10, 3600], [`forgot:email:${email}`, 3, 3600]]))) return { error: TOO_MANY };
  const r = await requestPasswordReset(email);
  if (r) mailLater(email, T.resetPassword(appUrl(`/reset?token=${r.token}`)));
  return { saved: true }; // même réponse pour une adresse inconnue
}

export async function resetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const get = str(fd);
  const pwErr = validatePassword(get("password"));
  if (pwErr) return { fieldErrors: { password: pwErr } };
  if (get("password") !== get("confirm")) return { fieldErrors: { confirm: "Les deux mots de passe ne correspondent pas." } };
  if (!(await allowed([[`reset:ip:${await clientIp()}`, 20, 3600]]))) return { error: TOO_MANY };
  if (!(await resetPassword(get("token"), get("password")))) return { error: "Ce lien est invalide ou a expiré. Refaites une demande." };
  redirect("/login?reset=1");
}

export async function deleteAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (fd.get("confirm") !== "on") return { fieldErrors: { confirm: "Cochez la case pour confirmer." } };
  if (!(await allowed([[`delete:user:${user.id}`, 5, 3600]]))) return { error: TOO_MANY };
  if (!(await deleteAccount(user.id, str(fd)("password")))) return { fieldErrors: { password: "Mot de passe incorrect." } };
  await clearSessionCookie();
  redirect("/signup?deleted=1");
}

// ---------- Types d'événements (hôte connecté) ----------
export async function saveEventTypeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { host } = await requireHost();
  const parsed = parseEventTypeForm(str(fd), randomUUID);
  if (!parsed.ok) return { fieldErrors: parsed.errors };
  const id = String(fd.get("id") ?? "");
  if (id) {
    if (!(await updateEventType(host.id, id, parsed.value))) return { error: "Ce type d'événement n'existe plus." };
  } else {
    await createEventType(host.id, parsed.value);
  }
  revalidatePath("/event-types");
  redirect("/event-types");
}

export async function deleteEventTypeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { host } = await requireHost();
  const res = await deleteEventType(host.id, String(fd.get("id")));
  if (res === "has_bookings") return { error: "Des réservations existent pour ce type : désactivez-le plutôt que de le supprimer." };
  revalidatePath("/event-types");
  return {};
}

export async function toggleEventTypeAction(fd: FormData) {
  const { host } = await requireHost();
  await setEventTypeActive(host.id, String(fd.get("id")), fd.get("active") === "true");
  revalidatePath("/event-types");
}

export async function saveAvailabilityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { host } = await requireHost();
  const parsed = parseAvailability(String(fd.get("weekly") ?? ""), String(fd.get("overrides") ?? ""), String(fd.get("timezone") ?? ""));
  if (!parsed.ok) return { fieldErrors: parsed.errors };
  await saveAvailability(host.id, parsed.value.rules, parsed.value.overrides, parsed.value.timezone);
  revalidatePath("/availability");
  return { saved: true };
}

// ---------- Réservation (public) ----------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BookResult =
  | { ok: true; token: string; redirectUrl?: string }
  | { ok: false; code: "slot_taken" | "slot_unavailable" | "invalid" | "rate_limited"; message: string; fieldErrors?: Record<string, string> };

export async function bookAction(input: {
  username: string; slug: string; startAt: string; guestName: string; guestEmail: string; guestTimezone: string;
  answers?: Record<string, string>; rescheduleToken?: string;
}): Promise<BookResult> {
  const host = await getHostByUsername(input.username);
  const et = host ? await getEventTypeBySlug(host.id, input.slug) : null;
  if (!host || !et || !et.active) return { ok: false, code: "invalid", message: "Cette page de réservation n'existe plus." };
  const name = input.guestName.trim();
  const email = input.guestEmail.trim();
  if (!name || name.length > 120) return { ok: false, code: "invalid", message: "Indiquez votre nom." };
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, code: "invalid", message: "Cette adresse e-mail ne semble pas valide." };
  if (Number.isNaN(Date.parse(input.startAt))) return { ok: false, code: "invalid", message: "Créneau invalide." };
  try { new Intl.DateTimeFormat("fr-FR", { timeZone: input.guestTimezone }); } catch { return { ok: false, code: "invalid", message: "Fuseau horaire invalide." }; }

  const answers: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};
  for (const q of et.questions) {
    const v = String(input.answers?.[q.id] ?? "").trim().slice(0, 1000);
    if (q.required && (!v || (q.kind === "checkbox" && v !== "true"))) fieldErrors[q.id] = "Cette réponse est obligatoire.";
    else if (q.kind === "select" && v && !q.options.includes(v)) fieldErrors[q.id] = "Choisissez l'une des propositions.";
    if (v) answers[q.id] = v;
  }
  if (Object.keys(fieldErrors).length) return { ok: false, code: "invalid", message: "Certaines réponses sont à corriger.", fieldErrors };

  // Une réservation envoie des e-mails à une adresse saisie par un inconnu : on limite par IP et par adresse.
  if (!(await allowed([[`book:ip:${await clientIp()}`, 30, 3600], [`book:email:${email.toLowerCase()}`, 10, 3600]]))) {
    return { ok: false, code: "rate_limited", message: "Trop de réservations en peu de temps. Réessayez plus tard." };
  }

  try {
    const booking = await createBooking(host, et, { startAt: input.startAt, guestName: name, guestEmail: email, guestTimezone: input.guestTimezone, answers, rescheduleToken: input.rescheduleToken });
    flushJobs();
    revalidatePath("/bookings");
    return { ok: true, token: booking.manageToken, redirectUrl: et.confirmationRedirectUrl || undefined };
  } catch (e) {
    if (e instanceof SlotTakenError) return { ok: false, code: "slot_taken", message: "Ce créneau vient d'être pris. Choisissez-en un autre." };
    if (e instanceof SlotUnavailableError) return { ok: false, code: "slot_unavailable", message: "Ce créneau n'est plus proposé. Choisissez-en un autre." };
    throw e;
  }
}

/** Annulation par l'invité : le jeton du lien reçu par e-mail fait foi. */
export async function cancelBookingAsGuestAction(fd: FormData) {
  const token = String(fd.get("token"));
  await cancelBooking(token, "guest", String(fd.get("reason") ?? "").trim().slice(0, 500));
  flushJobs();
  revalidatePath("/bookings");
  redirect(`/booking/${token}`);
}

/** Annulation par l'hôte connecté. */
export async function cancelBookingAsHostAction(fd: FormData) {
  const { host } = await requireHost();
  await cancelBooking(String(fd.get("token")), "host", "", host.id);
  flushJobs();
  revalidatePath("/bookings");
}
