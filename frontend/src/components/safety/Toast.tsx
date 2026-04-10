// ---------------------------------------------------------------------------
// CMP-TOAST — Success/error toast notifications
// ---------------------------------------------------------------------------

import { useEffect } from "react";
import { X } from "lucide-react";
import type { ToastMessage } from "../../types";

const borderColors: Record<string, string> = {
  success: "var(--positive)",
  error: "var(--negative)",
  warning: "var(--warning)",
  info: "var(--info)",
};

export function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.persistent) return;
    const t = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div
      style={{
        background: "var(--surface-raised)",
        borderLeft: `3px solid ${borderColors[toast.type] ?? "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
        maxWidth: 380,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        fontSize: "0.875rem",
      }}
    >
      <span>{toast.message}</span>
      <button className="btn-ghost" onClick={() => onDismiss(toast.id)}>
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
