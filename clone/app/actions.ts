"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cancelBooking, createBooking, createEventType, getBookingByToken, getCurrentHost, getEventTypeBySlug, getHostByUsername, setEventTypeActive, setRules } from "@/lib/store";
import { SlotTakenError, SlotUnavailableError } from "@/lib/types";
import type { Rule } from "@/lib/availability";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createEventTypeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = String(fd.get("name") ?? "").trim();
  const duration = Number(fd.get("duration"));
  const locationKind = String(fd.get("locationKind") ?? "video") as "video" | "phone" | "in_person" | "custom";
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Donnez un nom à ce type d'événement.";
  else if (name.length > 80) fieldErrors.name = "80 caractères au maximum.";
  if (!Number.isInteger(duration) || duration < 5 || duration > 720) fieldErrors.duration = "Choisissez une durée entre 5 et 720 minutes.";
  if (!["video", "phone", "in_person", "custom"].includes(locationKind)) fieldErrors.locationKind = "Lieu non reconnu.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  createEventType(getCurrentHost().id, {
    name, durationMinutes: duration, locationKind,
    locationDetail: String(fd.get("locationDetail") ?? "").trim().slice(0, 200),
    description: String(fd.get("description") ?? "").trim().slice(0, 1000),
    color: "var(--color-accent)",
  });
  revalidatePath("/event-types");
  redirect("/event-types");
}

export async function toggleEventTypeAction(fd: FormData) {
  setEventTypeActive(getCurrentHost().id, String(fd.get("id")), fd.get("active") === "true");
  revalidatePath("/event-types");
}

export async function saveAvailabilityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const rules: Rule[] = [];
  const fieldErrors: Record<string, string> = {};
  for (let weekday = 0; weekday < 7; weekday++) {
    if (fd.get(`on-${weekday}`) !== "on") continue;
    const start = String(fd.get(`start-${weekday}`) ?? "");
    const end = String(fd.get(`end-${weekday}`) ?? "");
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || end <= start) {
      fieldErrors[`day-${weekday}`] = "L'heure de fin doit suivre l'heure de début.";
      continue;
    }
    rules.push({ weekday, start, end });
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  setRules(getCurrentHost().id, rules);
  revalidatePath("/availability");
  return { saved: true };
}

export type BookResult = { ok: true; token: string } | { ok: false; code: "slot_taken" | "slot_unavailable" | "invalid"; message: string };

export async function bookAction(input: {
  username: string; slug: string; startAt: string; guestName: string; guestEmail: string; guestTimezone: string; rescheduleToken?: string;
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
  try {
    const booking = createBooking(host, et, { startAt: input.startAt, guestName: name, guestEmail: email, guestTimezone: input.guestTimezone });
    if (input.rescheduleToken) {
      const old = getBookingByToken(input.rescheduleToken);
      if (old && old.guestEmail.toLowerCase() === email.toLowerCase()) cancelBooking(old.manageToken, "guest", "Remplacé par un nouveau créneau");
    }
    revalidatePath("/bookings");
    return { ok: true, token: booking.manageToken };
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
