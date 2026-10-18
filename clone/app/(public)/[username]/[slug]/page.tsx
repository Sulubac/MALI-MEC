import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/BookingFlow";
import { LOCATION_LABEL } from "@/lib/format";
import { getBookingContext, getEventTypeBySlug, getHostByUsername, listSlots } from "@/lib/store";

export async function generateMetadata({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const host = await getHostByUsername(username.toLowerCase());
  const et = host ? await getEventTypeBySlug(host.id, slug.toLowerCase()) : null;
  return { title: et && host ? `${et.name} avec ${host.displayName}` : "Page introuvable" };
}

export default async function BookPage({ params, searchParams }: {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ reschedule?: string }>;
}) {
  const { username: rawUser, slug: rawSlug } = await params;
  const username = rawUser.toLowerCase(), slug = rawSlug.toLowerCase();
  const { reschedule } = await searchParams;
  const host = await getHostByUsername(username);
  const et = host ? await getEventTypeBySlug(host.id, slug) : null;
  if (!host || !et || !et.active) notFound();
  const ctx = reschedule ? await getBookingContext(reschedule) : null;
  const old = ctx?.booking;
  const valid = old && old.status === "confirmed" && old.hostId === host.id;
  return (
    <BookingFlow
      username={username} slug={slug} hostName={host.displayName} hostTimezone={host.timezone}
      eventName={et.name} durationMinutes={et.durationMinutes} description={et.description}
      locationLabel={LOCATION_LABEL[et.locationKind]} slots={await listSlots(host, et)} questions={et.questions}
      reschedule={valid ? { token: old.manageToken, guestName: old.guestName, guestEmail: old.guestEmail } : undefined}
    />
  );
}
