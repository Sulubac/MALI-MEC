"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  cancelBooking, createBooking, createEventType, deleteEventType, getBookingByToken, getCurrentHost,
  getEventTypeBySlug, getHostByUsername, setEventTypeActive, setHostTimezone, setOverrides, setRules, updateEventType,
} from "@/lib/store";
import { SlotTakenError, SlotUnavailableError } from "@/lib/types";
import { parseAvailability, parseEventTypeForm } from "@/lib/validate";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (fd: FormData) => (k: string) => String(fd.get(k) ?? "");

export async function saveEventTypeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = parseEventTypeForm(str(fd), randomUUID);
  if (!parsed.ok) return { fieldErrors: parsed.errors };
  const host = getCurrentHost();
  const id = String(fd.get("id") ?? "");
  if (id) {
    if (!updateEventType(host.id, id, parsed.value)) return { error: "Ce type d'événement n'existe plus." };
  } else {
    createEventType(host.id, parsed.value);
  }
  revalidatePath("/event-types");
  redirect("/event-types");
}

export async function deleteEventTypeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const res = deleteEventType(getCurrentHost().id, String(fd.get("id")));
  if (res === "has_bookings") return { error: "Des réservations existent pour ce type : désactivez-le plutôt que de le supprimer." };
  revalidatePath("/event-types");
  return {};
}

export async function toggleEventTypeAction(fd: FormData) {
  setEventTypeActive(getCurrentHost().id, String(fd.get("id")), fd.get("active") === "true");
  revalidatePath("/event-types");
}

export async function saveAvailabilityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = parseAvailability(String(fd.get("weekly") ?? ""), String(fd.get("overrides") ?? ""), String(fd.get("timezone") ?? ""));
  if (!parsed.ok) return { fieldErrors: parsed.errors };
  const host = getCurrentHost();
  setRules(host.id, parsed.value.rules);
  setOverrides(host.id, parsed.value.overrides);
  setHostTimezone(host.id, parsed.value.timezone);
  revalidatePath("/availability");
  return { saved: true };
}

export type BookResult =
  | { ok: true; token: string; redirectUrl?: string }
  | { ok: false; code: "slot_taken" | "slot_unavailable" | "invalid"; message: string; fieldErrors?: Record<string, string> };

export async function bookAction(input: {
  username: string; slug: string; startAt: string; guestName: string; guestEmail: string; guestTimezone: string;
  answers?: Record<string, string>; rescheduleToken?: string;
}): Promise<BookResult> {
  const host = getHostByUsername(input.username);
  const et = host ? getEventTypeBySlug(host.id, input.slug) : null;
  if (!host || !et || !et.active) return { ok: false, code: "invalid", message: "Cette page de réservation n'existe plus." };
  const name = input.guestName.trim();
  const email = input.guestEmail.trim();
  if (!name || name.length > 120) return { ok: false, code: "invalid", message: "Indiquez votre nom." };
  if (!EMAIL.test(email)) return { ok: false, code: "invalid", message: "Cette adresse e-mail ne semble pas valide." };
  if (Number.isNaN(Date.parse(input.startAt))) return { ok: false, code: "invalid", message: "Créneau invalide." };
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: input.guestTimezone });
  } catch {
    return { ok: false, code: "invalid", message: "Fuseau horaire invalide." };
  }

  const answers: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};
  for (const q of et.questions) {
    const v = String(input.answers?.[q.id] ?? "").trim().slice(0, 1000);
    if (q.required && (!v || (q.kind === "checkbox" && v !== "true"))) fieldErrors[q.id] = "Cette réponse est obligatoire.";
    else if (q.kind === "select" && v && !q.options.includes(v)) fieldErrors[q.id] = "Choisissez l'une des propositions.";
    if (v) answers[q.id] = v;
  }
  if (Object.keys(fieldErrors).length) return { ok: false, code: "invalid", message: "Certaines réponses sont à corriger.", fieldErrors };

  try {
    const booking = createBooking(host, et, { startAt: input.startAt, guestName: name, guestEmail: email, guestTimezone: input.guestTimezone, answers });
    if (input.rescheduleToken) {
      const old = getBookingByToken(input.rescheduleToken);
      if (old && old.guestEmail.toLowerCase() === email.toLowerCase()) cancelBooking(old.manageToken, "guest", "Remplacé par un nouveau créneau");
    }
    revalidatePath("/bookings");
    return { ok: true, token: booking.manageToken, redirectUrl: et.confirmationRedirectUrl || undefined };
  } catch (e) {
    if (e instanceof SlotTakenError) return { ok: false, code: "slot_taken", message: "Ce créneau vient d'être pris. Choisissez-en un autre." };
    if (e instanceof SlotUnavailableError) return { ok: false, code: "slot_unavailable", message: "Ce créneau n'est plus proposé. Choisissez-en un autre." };
    throw e;
  }
}

export async function cancelBookingAction(fd: FormData) {
  const token = String(fd.get("token"));
  const by = fd.get("by") === "host" ? "host" : "guest";
  cancelBooking(token, by, String(fd.get("reason") ?? "").trim().slice(0, 500));
  revalidatePath("/bookings");
  revalidatePath(`/booking/${token}`);
  if (by === "host") return;
  redirect(`/booking/${token}`);
}
