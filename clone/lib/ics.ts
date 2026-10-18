// Fichier d'agenda iCalendar (RFC 5545) : échappement du texte et pliage des lignes à 75 octets.

/** Échappe une valeur de type TEXT : antislash d'abord, puis « ; », « , » et les sauts de ligne. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Plie une ligne à 75 octets (UTF-8) maximum : les suites commencent par une espace. Ne coupe jamais un caractère en deux. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) { // itère par point de code : un emoji reste entier
    const n = Buffer.byteLength(ch);
    if (bytes + n > limit) {
      out.push(cur);
      cur = " ";
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n");
}

const stamp = (d: Date | string) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildIcs(e: { uid: string; start: string; end: string; summary: string; location: string; now?: Date }): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Planifier//FR", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${e.uid}`, `DTSTAMP:${stamp(e.now ?? new Date())}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`,
    `SUMMARY:${escapeText(e.summary)}`,
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
