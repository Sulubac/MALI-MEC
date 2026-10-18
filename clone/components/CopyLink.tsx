"use client";
import { useState } from "react";
import { Button } from "./ui";

export function CopyLink({ path }: { path: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setState("ok");
    } catch {
      setState("fail");
    }
    setTimeout(() => setState("idle"), 3000);
  }
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={copy}>Copier le lien</Button>
      <span role="status" className="sr-only">{state === "ok" ? "Lien copié" : state === "fail" ? "Copie impossible" : ""}</span>
      {state === "ok" && <span aria-hidden className="text-sm text-success">Lien copié</span>}
      {state === "fail" && <span aria-hidden className="text-sm text-danger">Copie impossible</span>}
    </>
  );
}
