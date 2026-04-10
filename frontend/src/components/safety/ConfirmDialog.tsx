// ---------------------------------------------------------------------------
// CMP-CONFIRM-DIALOG — Destructive / high-risk action confirmation modal
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", destructive, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-6)",
        maxWidth: 480,
        width: "90vw",
        color: "var(--text-primary)",
      }}
    >
      <h3 style={{ marginBottom: "var(--space-3)" }}>{title}</h3>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>{message}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className={destructive ? "btn-destructive" : "btn-primary"} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
