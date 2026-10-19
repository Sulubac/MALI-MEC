// Agenda externe : connexion chiffrée, plages occupées, écriture des réservations. S'appuie sur lib/google.ts.
import { decryptSecret, encryptSecret } from "./crypto.ts";
import { pool, query } from "./db.ts";
import { appUrl } from "./email.ts";
import {
  canReadBusy, canWriteEvents, deleteEvent, DISPLAY_TIMEOUT_MS, eventIdFor, freeBusy, GoogleError, googleConfig, insertEvent, refreshAccessToken,
  revokeToken, type BusyInterval, type GoogleConfig, type TokenSet,
} from "./google.ts";
import { enqueueEmail, type CalendarJob } from "./queue.ts";
import { CalendarUnavailableError, SlotTakenError } from "./types.ts";

type Conn = {
  id: string; user_id: string; external_account: string; refresh_token_enc: string; scopes: string;
  check_busy: boolean; write_bookings: boolean; status: "active" | "revoked"; last_error: string | null; created_at: Date;
};
const COLS = "id, user_id, external_account, refresh_token_enc, scopes, check_busy, write_bookings, status, last_error, created_at";

export type CalendarView = {
  status: "active" | "revoked"; email: string; checkBusy: boolean; writeBookings: boolean;
  canWrite: boolean; lastError: string | null; connectedAt: string;
};

async function getConn(userId: string): Promise<Conn | null> {
  return (await query<Conn>(`select ${COLS} from calendar_connections where user_id = $1 and provider = 'google'`, [userId]))[0] ?? null;
}

export async function getCalendarView(userId: string): Promise<CalendarView | null> {
  const c = await getConn(userId);
  if (!c) return null;
  return {
    status: c.status, email: c.external_account, checkBusy: c.check_busy, writeBookings: c.write_bookings,
    canWrite: canWriteEvents(c.scopes.split(" ")), lastError: c.last_error, connectedAt: c.created_at.toISOString(),
  };
}

export async function saveConnection(userId: string, t: TokenSet & { refreshToken: string }): Promise<{ canWrite: boolean }> {
  const canWrite = canWriteEvents(t.scopes);
  const previous = await getConn(userId);
  await query(
    `insert into calendar_connections (user_id, provider, external_account, refresh_token_enc, scopes, write_bookings)
     values ($1, 'google', $2, $3, $4, $5)
     on conflict (user_id, provider) do update set external_account = excluded.external_account,
       refresh_token_enc = excluded.refresh_token_enc, scopes = excluded.scopes, write_bookings = excluded.write_bookings,
       check_busy = true, status = 'active', last_error = null`,
    [userId, t.email ?? "compte Google", encryptSecret(t.refreshToken, userId), t.scopes.join(" "), canWrite],
  );
  tokenCache.delete(userId);
  busyCache.delete(userId);
  // L'ancien jeton reste valable chez Google tant qu'on ne le révoque pas : on le retire, pour ne laisser qu'un seul accès actif.
  if (previous) {
    try {
      const old = decryptSecret(previous.refresh_token_enc, userId);
      const cfg = googleConfig();
      if (cfg && old !== t.refreshToken) await revokeToken(cfg, old);
    } catch { /* ancien jeton illisible ou déjà révoqué : rien à faire */ }
  }
  return { canWrite };
}

export async function updateOptions(userId: string, o: { checkBusy: boolean; writeBookings: boolean }): Promise<void> {
  const c = await getConn(userId);
  if (!c) return;
  const write = o.writeBookings && canWriteEvents(c.scopes.split(" ")); // sans la portée d'écriture, l'option ne peut pas être activée
  await query("update calendar_connections set check_busy = $2, write_bookings = $3 where id = $1", [c.id, o.checkBusy, write]);
  busyCache.delete(userId);
}

/** Déconnecte : prévient Google (meilleur effort) puis supprime la ligne. Les événements déjà créés restent dans l'agenda. */
export async function disconnect(userId: string): Promise<void> {
  const c = await getConn(userId);
  const cfg = googleConfig();
  if (c && cfg) {
    try { await revokeToken(cfg, decryptSecret(c.refresh_token_enc, userId)); } catch { /* on déconnecte quand même */ }
  }
  await query("delete from calendar_connections where user_id = $1 and provider = 'google'", [userId]);
  tokenCache.delete(userId);
  busyCache.delete(userId);
}

// ---------- jetons d'accès (courte durée, gardés en mémoire) ----------
const g = globalThis as unknown as { __gTok?: Map<string, { token: string; exp: number }>; __gBusy?: Map<string, { from: number; to: number; at: number; busy: BusyInterval[] }> };
const tokenCache = (g.__gTok ??= new Map());
const busyCache = (g.__gBusy ??= new Map());

/** Passe la connexion en « révoquée » (une seule fois) et prévient l'hôte par e-mail. */
async function markRevoked(c: Conn, why: string): Promise<void> {
  tokenCache.delete(c.user_id);
  busyCache.delete(c.user_id);
  const r = await query("update calendar_connections set status = 'revoked', last_error = $2 where id = $1 and status = 'active' returning id", [c.id, why.slice(0, 300)]);
  if (r.length) await enqueueEmail(pool(), { template: "calendar_reconnect", userId: c.user_id, audience: "host" }, { key: `email:calendar_reconnect:${c.id}:${Date.now()}` });
}

async function accessToken(cfg: GoogleConfig, c: Conn, forceRefresh = false, timeoutMs?: number): Promise<string> {
  const hit = tokenCache.get(c.user_id);
  if (hit && hit.exp > Date.now() + 60_000 && !forceRefresh) return hit.token;
  let refreshToken: string;
  try {
    refreshToken = decryptSecret(c.refresh_token_enc, c.user_id);
  } catch {
    // Clé perdue ou changée : ce jeton ne se lira plus jamais. On le dit à l'hôte au lieu de bloquer ses réservations indéfiniment.
    await markRevoked(c, "La clé de chiffrement du serveur a changé : reconnectez votre agenda.");
    throw new GoogleError("invalid_grant", "jeton illisible (clé de chiffrement)");
  }
  try {
    const t = await refreshAccessToken(cfg, refreshToken, timeoutMs);
    tokenCache.set(c.user_id, { token: t.accessToken, exp: Date.now() + t.expiresInSec * 1000 });
    return t.accessToken;
  } catch (e) {
    if (e instanceof GoogleError && e.kind === "invalid_grant") await markRevoked(c, "Google a révoqué l'accès : reconnectez votre agenda.");
    throw e;
  }
}

/** Exécute un appel avec le jeton d'accès ; un 401 provoque un seul rafraîchissement puis une nouvelle tentative. */
async function withToken<T>(cfg: GoogleConfig, c: Conn, fn: (token: string) => Promise<T>, timeoutMs?: number): Promise<T> {
  try {
    return await fn(await accessToken(cfg, c, false, timeoutMs));
  } catch (e) {
    if (e instanceof GoogleError && e.kind === "unauthorized") return fn(await accessToken(cfg, c, true, timeoutMs));
    throw e;
  }
}

// ---------- plages occupées ----------
export async function calendarChecksBusy(hostId: string): Promise<boolean> {
  const c = await getConn(hostId);
  return !!c && c.status === "active" && c.check_busy && canReadBusy(c.scopes.split(" ")) && googleConfig() !== null;
}

/**
 * Plages occupées de l'agenda de l'hôte entre deux instants. `ok: false` = Google injoignable (le résultat est alors le dernier
 * connu, ou vide). Une connexion absente, désactivée ou révoquée donne simplement « aucune plage ».
 */
export async function externalBusy(hostId: string, fromMs: number, toMs: number, opts: { fresh?: boolean } = {}): Promise<{ busy: BusyInterval[]; ok: boolean }> {
  const cfg = googleConfig();
  const c = await getConn(hostId);
  if (!cfg || !c || c.status !== "active" || !c.check_busy || !canReadBusy(c.scopes.split(" "))) return { busy: [], ok: true };
  const cached = busyCache.get(hostId);
  if (!opts.fresh && cached && cached.from <= fromMs && cached.to >= toMs && Date.now() - cached.at < 30_000) return { busy: cached.busy, ok: true };
  try {
    const timeout = opts.fresh ? undefined : DISPLAY_TIMEOUT_MS; // affichage : court ; réservation : le délai normal
    const busy = await withToken(cfg, c, (tok) => freeBusy(cfg, tok, fromMs, toMs, timeout), timeout);
    busyCache.set(hostId, { from: fromMs, to: toMs, at: Date.now(), busy });
    return { busy, ok: true };
  } catch (e) {
    if (e instanceof GoogleError && e.kind === "invalid_grant") return { busy: [], ok: true }; // révoquée : l'hôte est prévenu, on n'interroge plus
    if (e instanceof GoogleError && (e.kind === "forbidden" || e.kind === "bad_request" || e.kind === "unauthorized")) {
      // Erreur durable : réessayer ne servirait à rien, et refuser toute réservation non plus. L'hôte est prévenu, les réservations continuent.
      const why = e.kind === "forbidden" ? "Google a refusé l'accès à l'agenda (autorisation insuffisante ou API Google Calendar non activée) : reconnectez-le en acceptant toutes les autorisations."
        : e.kind === "unauthorized" ? "Google ne reconnaît plus l'accès à l'agenda : reconnectez-le."
        : "Google a rejeté la lecture de l'agenda : reconnectez-le, et si le problème persiste contactez l'administrateur du service.";
      await markRevoked(c, why);
      return { busy: [], ok: true };
    }
    return { busy: cached && cached.from <= fromMs && cached.to >= toMs ? cached.busy : [], ok: false };
  }
}

/**
 * Contrôle qui fait autorité au moment de réserver : interroge Google sans cache. Refuse si le créneau (marges comprises)
 * touche un événement, ou si Google est injoignable (mieux vaut refuser un instant qu'une double réservation).
 */
export async function assertCalendarFree(hostId: string, startMs: number, endMs: number, bufferBeforeMs: number, bufferAfterMs: number): Promise<void> {
  const from = startMs - bufferBeforeMs, to = endMs + bufferAfterMs;
  const { busy, ok } = await externalBusy(hostId, from - 60_000, to + 60_000, { fresh: true });
  if (!ok) throw new CalendarUnavailableError();
  if (busy.some((b) => from < b.end && to > b.start)) throw new SlotTakenError();
}

// ---------- écriture des réservations ----------
type BkCtx = {
  id: string; status: string; start_at: Date; end_at: Date; guest_name: string; guest_email: string; guest_timezone: string;
  answers: Record<string, string>; host_id: string; name: string; location_detail: string; questions: { id: string; label: string }[]; host_tz: string;
};

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

export async function runCalendarJob(p: CalendarJob): Promise<"done" | "skipped"> {
  const r = (await query<BkCtx>(
    `select b.id, b.status, b.start_at, b.end_at, b.guest_name, b.guest_email, b.guest_timezone, b.answers, b.host_id,
            et.name, et.location_detail, et.questions, pr.timezone as host_tz
     from bookings b join event_types et on et.id = b.event_type_id join profiles pr on pr.id = b.host_id where b.id = $1`, [p.bookingId]))[0];
  if (!r) return "skipped"; // réservation supprimée avec le compte
  const c = await getConn(r.host_id);
  if (!c || c.status !== "active" || !c.write_bookings) return "skipped"; // plus de connexion : rien à écrire
  const cfg = googleConfig();
  if (!cfg) throw new Error("Google non configuré sur ce serveur");
  const id = eventIdFor(r.id);
  try {
    if (p.op === "delete") {
      await withToken(cfg, c, (tok) => deleteEvent(cfg, tok, id));
      return "done";
    }
    if (r.status !== "confirmed") return "skipped";
    const answers = r.questions.filter((q) => r.answers[q.id]).map((q) => `${oneLine(q.label)} : ${r.answers[q.id]}`);
    await withToken(cfg, c, (tok) => insertEvent(cfg, tok, {
      id, summary: oneLine(`${r.name} : ${r.guest_name}`),
      description: [`Réservé par ${oneLine(r.guest_name)} (${oneLine(r.guest_email)})`, `Fuseau de l'invité : ${r.guest_timezone}`, ...answers, "", `Vos réunions : ${appUrl("/bookings")}`].join("\n"),
      location: oneLine(r.location_detail), startIso: r.start_at.toISOString(), endIso: r.end_at.toISOString(), timeZone: r.host_tz,
    }));
    await query("update bookings set external_event_id = $2 where id = $1", [r.id, id]);
    return "done";
  } catch (e) {
    if (e instanceof GoogleError) {
      if (e.kind === "invalid_grant") return "skipped"; // déjà marquée révoquée, l'hôte est prévenu
      if (e.kind !== "temporary") {
        const friendly = e.kind === "forbidden" ? "Google a refusé l'écriture dans votre agenda (autorisation insuffisante) : reconnectez-le en acceptant toutes les autorisations."
          : "Google a rejeté l'ajout d'un rendez-vous à votre agenda. Le détail est dans le journal du serveur.";
        await query("update calendar_connections set last_error = $2 where id = $1", [c.id, friendly]);
      }
    }
    throw e;
  }
}
