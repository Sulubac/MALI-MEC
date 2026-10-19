export type Host = { id: string; username: string; displayName: string; timezone: string };

export type Question = {
  id: string;
  label: string;
  kind: "text" | "textarea" | "select" | "checkbox";
  options: string[];
  required: boolean;
};

export type EventType = {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  color: string;
  description: string;
  durationMinutes: number;
  locationKind: "video" | "phone" | "in_person" | "custom";
  locationDetail: string;
  active: boolean;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  limitPerDay: number | null;
  limitPerWeek: number | null;
  stepMinutes: number;
  questions: Question[];
  confirmationRedirectUrl: string;
};

/** Réglages modifiables d'un type d'événement (tout sauf identité, propriétaire et lien). */
export type EventTypeInput = Pick<EventType,
  "name" | "description" | "durationMinutes" | "locationKind" | "locationDetail" | "minNoticeMinutes" | "maxDaysAhead" |
  "bufferBeforeMinutes" | "bufferAfterMinutes" | "limitPerDay" | "limitPerWeek" | "questions" | "confirmationRedirectUrl">;

export type Booking = {
  id: string;
  eventTypeId: string;
  hostId: string;
  startAt: string; // ISO UTC
  endAt: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  answers: Record<string, string>;
  status: "confirmed" | "cancelled";
  cancelReason: string | null;
  cancelledBy: "host" | "guest" | null;
  manageToken: string;
};

export class SlotTakenError extends Error {
  constructor() { super("slot_taken"); }
}
/** L'agenda externe de l'hôte n'a pas pu être consulté : on refuse plutôt que de risquer une double réservation. */
export class CalendarUnavailableError extends Error {
  constructor() { super("calendar_unavailable"); }
}
export class SlotUnavailableError extends Error {
  constructor() { super("slot_unavailable"); }
}
