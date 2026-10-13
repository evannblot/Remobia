"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import QuoteWizard from "./QuoteWizard";

type PartsQuoteButtonProps = {
  initialIssue?: string;
  label?: string;
  secondary?: boolean;
};

export default function PartsQuoteButton({
  initialIssue,
  label = "Demander mon devis gratuit",
  secondary = false,
}: PartsQuoteButtonProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const previousOverflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [open]);

  const close = () => setOpen(false);

  return <>
    <button
      type="button"
      className={`button ${secondary ? "button-outline" : "button-primary"} parts-quote-button`}
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      {label}<ArrowRight size={18} aria-hidden="true" />
    </button>
    <dialog
      ref={dialogRef}
      className="quote-dialog parts-quote-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClose={close}
      onClick={(event) => { if (event.target === dialogRef.current) close(); }}
    >
      <div className="dialog-header">
        <span className="brand-lockup brand-small"><span className="brand-words">remobia</span></span>
        <span id={titleId} className="sr-only">Demande de devis gratuit</span>
        <button type="button" className="dialog-close" aria-label="Fermer la demande de devis" onClick={close}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      {open && <QuoteWizard initialIssue={initialIssue} onClose={close} />}
    </dialog>
  </>;
}
