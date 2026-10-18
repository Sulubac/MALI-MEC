import { buildIcs } from "@/lib/ics";
import { getBookingContext } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await getBookingContext(token);
  if (!ctx || ctx.booking.status !== "confirmed") return new Response("Introuvable", { status: 404 });
  const body = buildIcs({
    uid: `${ctx.booking.id}@planifier`, start: ctx.booking.startAt, end: ctx.booking.endAt,
    summary: ctx.eventType.name, location: ctx.eventType.locationDetail,
  });
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="rendez-vous.ics"' } });
}
