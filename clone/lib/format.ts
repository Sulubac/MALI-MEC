export function formatDateTime(iso: string, tz: string, locale = "fr-FR"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}
export function formatTime(iso: string, tz: string, locale = "fr-FR"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
export function formatDay(iso: string, tz: string, locale = "fr-FR"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}
export const LOCATION_LABEL: Record<string, string> = {
  video: "Visioconférence", phone: "Téléphone", in_person: "En personne", custom: "Autre lieu",
};
