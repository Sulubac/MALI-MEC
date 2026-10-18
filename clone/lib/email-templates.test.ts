import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "./email-templates.ts";
import type { Booking, EventType, Host } from "./types.ts";

const host: Host = { id: "h", username: "alice", displayName: "Alice\r\nBcc: pirate@example.com", timezone: "Europe/Paris" };
const et = { name: "Séance\nX-Injecté: oui", durationMinutes: 30, locationKind: "video", locationDetail: "" } as EventType;
const booking = {
  id: "b", startAt: "2026-11-02T08:00:00.000Z", endAt: "2026-11-02T08:30:00.000Z", guestName: "Bob\r\nBcc: autre@example.com",
  guestEmail: "bob@example.com", guestTimezone: "America/New_York", manageToken: "tok", status: "confirmed", cancelReason: "a\nb", cancelledBy: "guest",
} as Booking;
const ctx = { booking, eventType: et, host, baseUrl: (p: string) => `http://app.test${p}` };

test("aucun objet d'e-mail ne contient de saut de ligne (injection d'en-têtes)", () => {
  for (const m of [T.bookingConfirmation(ctx), T.hostNotification(ctx), T.bookingReminder(ctx), T.bookingCancelled(ctx, "guest"), T.bookingCancelled(ctx, "host")]) {
    assert.ok(!/[\r\n]/.test(m.subject), `objet : ${JSON.stringify(m.subject)}`);
  }
});

test("le fuseau de l'invité est utilisé pour l'invité, celui de l'hôte pour l'hôte", () => {
  assert.match(T.bookingConfirmation(ctx).text, /03:00/); // 08:00Z = 03:00 à New York (EST)
  assert.match(T.hostNotification(ctx).text, /09:00/); // 09:00 à Paris (CET)
});
