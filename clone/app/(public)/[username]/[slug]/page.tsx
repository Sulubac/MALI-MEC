import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/BookingFlow";
import { LOCATION_LABEL } from "@/lib/format";
import { getBookingByToken, getEventTypeBySlug, getHostByUsername, listSlots } from "@/lib/store";

export default async function BookPage({ params, searchParams }: {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ reschedule?: string }>;
}) {
  const { username, slug } = await params;
  const { reschedule } = await searchParams;
  const host = getHostByUsername(username);
  const et = host ? getEventTypeBySlug(host.id, slug) : null;
  if (!host || !et || !et.active) notFound();
  const old = reschedule ? getBookingByToken(reschedule) : null;
  const valid = old && old.status === "confirmed" && old.hostId === host.id;
  return (
    <BookingFlow
      username={username} slug={slug} hostName={host.displayName} hostTimezone={host.timezone}
      eventName={et.name} durationMinutes={et.durationMinutes} description={et.description}
      locationLabel={LOCATION_LABEL[et.locationKind]} slots={listSlots(host, et)} questions={et.questions}
      reschedule={valid ? { token: old.manageToken, guestName: old.guestName, guestEmail: old.guestEmail } : undefined}
    />
  );
}
