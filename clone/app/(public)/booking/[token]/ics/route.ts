import { getBookingContext } from "@/lib/store";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await getBookingContext(token);
  if (!ctx || ctx.booking.status !== "confirmed") return new Response("Introuvable", { status: 404 });
  const b = ctx.booking;
  const et = ctx.eventType;
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Planifier//FR", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${b.id}@planifier`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.startAt)}`, `DTEND:${stamp(b.endAt)}`,
    `SUMMARY:${esc(et?.name ?? "Rendez-vous")}`, `LOCATION:${esc(et?.locationDetail ?? "")}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="rendez-vous.ics"' } });
}
