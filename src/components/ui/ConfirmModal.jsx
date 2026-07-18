import { useEffect } from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";

// Modal de confirmacion generico (pensado para acciones destructivas como
// eliminar). Centrado, con backdrop que cierra al hacer click afuera o Esc.
export const ConfirmModal = ({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  error,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !loading && onCancel()}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />

      <div className="glass-surface relative z-10 w-full max-w-sm rounded-3xl bg-background p-6">
        <h2 className="text-[17px] font-semibold text-ink-50">{title}</h2>
        {description && <p className="mt-2 text-[14px] text-ink-300">{description}</p>}

        <Alert>{error}</Alert>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" className="sm:w-auto sm:px-6" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
