"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  cancelGoogleSignupAction, completeGoogleSignupAction, deleteAccountAction, forgotAction, googleSignInAction, loginAction,
  resendVerificationAction, resetAction, signupAction, verifyAction,
} from "@/app/actions";
import { Button, Field, Notice, TextInput } from "./ui";
import { useKeptForm } from "./useKeptForm";

const useForm = useKeptForm;

/** Bouton texte seul : le logo et le style officiels de Google sont à ajouter avant la vérification de l'application (voir backend.md). */
export function GoogleButton({ label }: { label: string }) {
  return (
    <form action={googleSignInAction}>
      <Button type="submit" variant="secondary" className="w-full">{label}</Button>
    </form>
  );
}

function Or() {
  return <p className="text-center text-sm text-muted" aria-hidden>ou</p>;
}

export function LoginForm({ notice, googleEnabled = false, errorText }: { notice?: "verified" | "reset"; googleEnabled?: boolean; errorText?: string }) {
  const [state, action, pending] = useForm(loginAction);
  const [resend, resendAction, resending] = useForm(resendVerificationAction);
  return (
    <div className="space-y-5">
      <h1>Connexion</h1>
      {notice === "verified" && <Notice tone="success">Adresse confirmée. Vous pouvez vous connecter.</Notice>}
      {notice === "reset" && <Notice tone="success">Mot de passe modifié. Reconnectez-vous.</Notice>}
      {errorText && <Notice>{errorText}</Notice>}
      {googleEnabled && (<><GoogleButton label="Continuer avec Google" /><Or /></>)}
      <form onSubmit={action} className="space-y-4" noValidate>
        {state.error && <Notice>{state.error}</Notice>}
        <Field id="email" label="Adresse e-mail"><TextInput id="email" name="email" type="email" autoComplete="email" required /></Field>
        <Field id="password" label="Mot de passe"><TextInput id="password" name="password" type="password" autoComplete="current-password" required /></Field>
        <Button type="submit" loading={pending} className="w-full">Se connecter</Button>
      </form>
      {state.unverifiedEmail && (
        <form onSubmit={resendAction} className="space-y-2">
          <input type="hidden" name="email" value={state.unverifiedEmail} />
          {resend.saved ? <Notice tone="success">Si cette adresse attend une confirmation, un nouveau lien vient d'être envoyé.</Notice> : (
            <Button type="submit" variant="secondary" loading={resending}>Renvoyer le lien de confirmation</Button>
          )}
          {resend.error && <Notice>{resend.error}</Notice>}
        </form>
      )}
      {googleEnabled && <p className="text-sm text-muted">Compte créé avec Google ? Utilisez le bouton « Continuer avec Google » ci-dessus : il n'a pas de mot de passe.</p>}
      <p className="text-sm"><Link href="/forgot" className="text-accent underline">Mot de passe oublié ?</Link></p>
      <p className="text-sm text-muted">Pas encore de compte ? <Link href="/signup" className="text-accent underline">Créer un compte</Link></p>
    </div>
  );
}

export function SignupForm({ deleted, googleEnabled = false, errorText }: { deleted?: boolean; googleEnabled?: boolean; errorText?: string }) {
  const [state, action, pending] = useForm(signupAction);
  const [tz, setTz] = useState("UTC");
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); } catch { /* UTC */ } }, []);
  const e = state.fieldErrors ?? {};
  if (state.saved) {
    return (
      <div className="space-y-4">
        <h1>Vérifiez votre boîte e-mail</h1>
        <Notice tone="success">Si l'adresse est valide, un message de confirmation vient d'être envoyé. Le lien est valable 24 heures.</Notice>
        <p className="text-sm text-muted">Rien reçu ? Regardez dans les courriers indésirables, ou <Link href="/login" className="text-accent underline">demandez un nouveau lien</Link> depuis la connexion.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <h1>Créer un compte</h1>
      {deleted && <Notice tone="success">Votre compte et vos données ont été supprimés.</Notice>}
      {errorText && <Notice>{errorText}</Notice>}
      {googleEnabled && (<><GoogleButton label="S'inscrire avec Google" /><Or /></>)}
      <form onSubmit={action} className="space-y-4" noValidate>
        {state.error && <Notice>{state.error}</Notice>}
        <input type="hidden" name="timezone" value={tz} />
        <Field id="displayName" label="Votre nom" error={e.displayName}><TextInput id="displayName" name="displayName" autoComplete="name" maxLength={80} required error={e.displayName} /></Field>
        <Field id="username" label="Nom dans votre lien" hint="Votre page sera à /nom. Lettres minuscules, chiffres et tirets." error={e.username}><TextInput id="username" name="username" autoComplete="username" maxLength={40} required error={e.username} /></Field>
        <Field id="email" label="Adresse e-mail" error={e.email}><TextInput id="email" name="email" type="email" autoComplete="email" required error={e.email} /></Field>
        <Field id="password" label="Mot de passe" hint="10 caractères au minimum." error={e.password}><TextInput id="password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required error={e.password} /></Field>
        <Button type="submit" loading={pending} className="w-full">Créer mon compte</Button>
      </form>
      <p className="text-sm text-muted">Déjà un compte ? <Link href="/login" className="text-accent underline">Se connecter</Link></p>
    </div>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useForm(forgotAction);
  return (
    <div className="space-y-5">
      <h1>Mot de passe oublié</h1>
      {state.saved ? (
        <Notice tone="success">Si un compte correspond à cette adresse, un lien de réinitialisation vient d'être envoyé. Il est valable 1 heure.</Notice>
      ) : (
        <form onSubmit={action} className="space-y-4" noValidate>
          {state.error && <Notice>{state.error}</Notice>}
          <Field id="email" label="Adresse e-mail"><TextInput id="email" name="email" type="email" autoComplete="email" required /></Field>
          <Button type="submit" loading={pending} className="w-full">Envoyer le lien</Button>
        </form>
      )}
      <p className="text-sm"><Link href="/login" className="text-accent underline">Retour à la connexion</Link></p>
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useForm(resetAction);
  const e = state.fieldErrors ?? {};
  return (
    <div className="space-y-5">
      <h1>Nouveau mot de passe</h1>
      <form onSubmit={action} className="space-y-4" noValidate>
        <input type="hidden" name="token" value={token} />
        {state.error && <Notice>{state.error}</Notice>}
        <Field id="password" label="Nouveau mot de passe" hint="10 caractères au minimum." error={e.password}><TextInput id="password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required error={e.password} /></Field>
        <Field id="confirm" label="Confirmez le mot de passe" error={e.confirm}><TextInput id="confirm" name="confirm" type="password" autoComplete="new-password" required error={e.confirm} /></Field>
        <Button type="submit" loading={pending} className="w-full">Changer le mot de passe</Button>
      </form>
    </div>
  );
}

export function VerifyForm({ token, valid }: { token: string; valid: boolean }) {
  const [state, action, pending] = useForm(verifyAction);
  return (
    <div className="space-y-5">
      <h1>Confirmer votre adresse</h1>
      {!valid && !state.error ? (
        <Notice>Ce lien est invalide ou a expiré. Demandez-en un nouveau depuis la <Link href="/login" className="underline">page de connexion</Link>.</Notice>
      ) : (
        <form onSubmit={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          {state.error && <Notice>{state.error}</Notice>}
          <p className="text-sm text-muted">Un dernier clic pour activer votre compte.</p>
          <Button type="submit" loading={pending}>Confirmer mon adresse</Button>
        </form>
      )}
    </div>
  );
}

export function GoogleSignupForm({ email, defaultName, defaultUsername }: { email: string; defaultName: string; defaultUsername: string }) {
  const [state, action, pending] = useForm(completeGoogleSignupAction);
  const [tz, setTz] = useState("UTC");
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); } catch { /* UTC */ } }, []);
  const e = state.fieldErrors ?? {};
  return (
    <div className="space-y-5">
      <h1>Terminer votre inscription</h1>
      <p className="text-sm text-muted">Compte Google : <span className="break-all font-semibold text-text">{email}</span>. Cette adresse est déjà confirmée par Google.</p>
      <form onSubmit={action} className="space-y-4" noValidate>
        {state.error && <Notice>{state.error}</Notice>}
        <input type="hidden" name="timezone" value={tz} />
        <Field id="displayName" label="Votre nom" error={e.displayName}><TextInput id="displayName" name="displayName" defaultValue={defaultName} maxLength={80} required error={e.displayName} /></Field>
        <Field id="username" label="Nom dans votre lien" hint="Votre page sera à /nom. Lettres minuscules, chiffres et tirets." error={e.username}><TextInput id="username" name="username" defaultValue={defaultUsername} maxLength={40} required error={e.username} /></Field>
        <Button type="submit" loading={pending} className="w-full">Créer mon compte</Button>
      </form>
      <form action={cancelGoogleSignupAction}><Button type="submit" variant="ghost">Annuler</Button></form>
    </div>
  );
}

export function DeleteAccountForm({ hasPassword = true, email = "", sessionFresh = true }: { hasPassword?: boolean; email?: string; sessionFresh?: boolean }) {
  const [state, action, pending] = useForm(deleteAccountAction);
  const e = state.fieldErrors ?? {};
  return (
    <form onSubmit={action} className="wrap-anywhere max-w-md space-y-4 rounded-lg border border-danger p-4" noValidate>
      <h2 className="text-base">Supprimer mon compte</h2>
      <p className="text-sm text-muted">Votre profil, vos types d'événements, vos disponibilités et toutes les réservations reçues sont effacés définitivement. Cette action est irréversible.</p>
      {state.error && <Notice>{state.error}</Notice>}
      {hasPassword ? (
        <Field id="del-password" label="Mot de passe" error={e.password}><TextInput id="del-password" name="password" type="password" autoComplete="current-password" required error={e.password} /></Field>
      ) : (
        <>
          {!sessionFresh && <Notice>Votre session date de plus de 15 minutes : déconnectez-vous puis reconnectez-vous avec Google avant de supprimer votre compte.</Notice>}
          <Field id="del-email" label="Tapez votre adresse e-mail pour confirmer" hint={`Votre compte n'a pas de mot de passe (connexion avec Google). Adresse du compte : ${email}`} error={e.email}>
            <TextInput id="del-email" name="email" type="email" autoComplete="off" required error={e.email} />
          </Field>
        </>
      )}
      <div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />Je comprends que mes données seront supprimées définitivement.</label>
        {e.confirm && <p className="text-sm text-danger">{e.confirm}</p>}
      </div>
      <Button type="submit" variant="danger" loading={pending}>Supprimer définitivement</Button>
    </form>
  );
}
