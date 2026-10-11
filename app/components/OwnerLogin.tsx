"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CatalogFooter, CatalogHeader } from "./PhoneCatalog";
import "./owner-login.css";

export default function OwnerLogin({ error = false, ownerEmail }: { error?: boolean; ownerEmail: string }) {
  const [codeRequested, setCodeRequested] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState(error ? "La connexion Google n’a pas abouti. Vous pouvez accéder à votre espace avec un code reçu par email." : "");
  const [cooldown, setCooldown] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function exchange(action: "send" | "verify") {
    if (inFlight.current || (action === "send" && cooldown)) return;
    inFlight.current = true;
    setBusy(action); setProblem(""); setNotice("");
    let navigating = false;
    try {
      const response = await fetch("/api/auth/owner-code", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "send" ? { action } : { action, otp }),
        signal: AbortSignal.timeout(15_000),
      });
      const data: unknown = await response.json().catch(() => null);
      const result = data && typeof data === "object" ? data as { ok?: unknown; error?: unknown } : null;
      if (!response.ok || result?.ok !== true) {
        if (action === "send" && (response.status >= 500 || response.ok)) {
          setCodeRequested(true); setCooldown(60);
          throw new Error("Impossible de confirmer l’envoi. Si vous recevez un code, vous pouvez le saisir ci-dessous. Sinon, réessayez dans un instant.");
        }
        const retryAfter = Number(response.headers.get("retry-after"));
        if (response.status === 429) setCooldown(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(300, Math.ceil(retryAfter)) : 60);
        throw new Error(typeof result?.error === "string" ? result.error : "La connexion est momentanément indisponible. Réessayez dans un instant.");
      }
      if (action === "verify") { navigating = true; window.location.replace("/gestion/telephones"); return; }
      setOtp(""); setCodeRequested(true); setCooldown(60);
      setNotice("Code envoyé. Consultez votre boîte email, puis saisissez les 6 chiffres ci-dessous. Pensez à vérifier les courriers indésirables.");
      requestAnimationFrame(() => input.current?.focus());
    } catch (cause) {
      if (action === "send" && (!(cause instanceof Error) || cause.name === "TimeoutError" || cause.name === "TypeError")) {
        setCodeRequested(true); setCooldown(60);
        setProblem("Impossible de confirmer l’envoi. Si vous recevez un code, vous pouvez le saisir ci-dessous. Sinon, réessayez dans un instant.");
      } else setProblem(cause instanceof Error && cause.name !== "TimeoutError" && cause.name !== "TypeError" ? cause.message : "La réponse tarde à arriver. Réessayez avec votre code.");
    } finally { if (!navigating) { inFlight.current = false; setBusy(null); } }
  }

  function verify(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (/^\d{6}$/.test(otp)) void exchange("verify"); }

  return <div className="catalog-site"><CatalogHeader management /><main className="container catalog-access" id="contenu">
    <p className="eyebrow">ESPACE PROPRIÉTAIRE</p><h1>Bienvenue dans<br /><span>votre atelier.</span></h1>
    <p>Recevez un code de connexion sur <strong>{ownerEmail}</strong> pour gérer vos annonces et consulter les demandes de reprise.</p>
    <div className="owner-code-panel">
      {notice && <p className="owner-code-notice" role="status">{notice}</p>}
      {problem && <p className="owner-code-error" role="alert">{problem}</p>}
      {codeRequested && <form onSubmit={verify} aria-busy={busy === "verify"}>
        <label htmlFor="owner-login-code">Votre code de connexion</label>
        <input ref={input} id="owner-login-code" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" maxLength={6} required value={otp} disabled={!!busy}
          onChange={event => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="6 chiffres" />
        <p className="owner-code-hint">Le code est temporaire. Utilisez le dernier code reçu.</p>
        <button className="button button-primary" disabled={!!busy || !/^\d{6}$/.test(otp)}>{busy === "verify" ? "Connexion…" : "Ouvrir mon espace"}</button>
      </form>}
      <button type="button" className={`button ${codeRequested ? "manager-cancel" : "button-primary"}`} disabled={!!busy || cooldown > 0} onClick={() => void exchange("send")}>
        {busy === "send" ? "Envoi du code…" : cooldown ? `Nouveau code dans ${cooldown} s` : codeRequested ? "Recevoir un nouveau code" : "Recevoir mon code par email"}
      </button>
    </div>
    <Link className="button manager-cancel" href="/">Revenir au site</Link>
  </main><CatalogFooter management /></div>;
}
