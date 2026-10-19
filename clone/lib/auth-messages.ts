// Messages d'erreur des pages de connexion et d'inscription, choisis par un code dans l'adresse (?error=…).
// Le code n'est jamais affiché tel quel : seuls les codes connus donnent un message (voir Object.hasOwn).
const MESSAGES: Record<string, string> = {
  google_denied: "Vous avez refusé l'accès : rien n'a été fait.",
  google_state: "La demande de connexion a expiré ou n'est pas valide. Recommencez.",
  google_failed: "Google n'a pas pu finaliser la connexion. Réessayez dans quelques minutes.",
  google_unverified: "Google n'a pas confirmé l'adresse e-mail de ce compte : impossible de l'utiliser ici.",
  google_exists: "Un compte existe déjà avec l'adresse e-mail de ce compte Google. Connectez-vous avec votre mot de passe, puis liez Google depuis la page Compte.",
  google_expired: "L'inscription avec Google a expiré (15 minutes). Recommencez.",
  google_rate: "Trop de tentatives. Réessayez dans quelques minutes.",
};

export function authMessage(code: string | undefined): string | undefined {
  return code && Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : undefined;
}
