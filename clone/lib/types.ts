export type Host = { id: string; username: string; displayName: string; timezone: string };

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
  stepMinutes: number;
};

export type Booking = {
  id: string;
  eventTypeId: string;
  hostId: string;
  startAt: string; // ISO UTC
  endAt: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  status: "confirmed" | "cancelled";
  cancelReason: string | null;
  cancelledBy: "host" | "guest" | null;
  manageToken: string;
};

export class SlotTakenError extends Error {
  constructor() { super("slot_taken"); }
}
export class SlotUnavailableError extends Error {
  constructor() { super("slot_unavailable"); }
}
