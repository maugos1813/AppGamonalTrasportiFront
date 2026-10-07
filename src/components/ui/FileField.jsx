import clsx from "clsx";
import { useEffect, useMemo } from "react";
import { CameraIcon, PaperclipIcon } from "./icons";

// Selector de archivo (foto o PDF) con vista previa. En el celular el selector del sistema
// ofrece sacar la foto en el momento. `existing` es el archivo ya guardado (al editar).
export const FileField = ({ id, label, hint, file, onChange, existing, required, error }) => {
  const preview = useMemo(
    () => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file]
  );
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-300">
        {label}
        {required && <span className="text-danger-500"> *</span>}
      </span>
      <label
        htmlFor={id}
        className={clsx(
          "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors hover:bg-line/10",
          error ? "border-danger-500/70" : "border-line/30"
        )}
      >
        {preview ? (
          <img src={preview} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-line/10 text-ink-300">
            {file ? <PaperclipIcon className="h-5 w-5" /> : <CameraIcon className="h-5 w-5" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink-50">
            {file ? file.name : existing ? "Reemplazar archivo" : "Sacar foto o elegir archivo"}
          </span>
          <span className="block text-[12px] text-ink-400">
            {file ? "Se subira al guardar" : hint}
          </span>
        </span>
        {file && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange(null);
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-300 hover:bg-line/10 hover:text-ink-50"
          >
            Quitar
          </button>
        )}
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            onChange(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </label>
      {existing && !file && (
        <a
          href={existing.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-block text-[12px] font-medium text-accent-400 hover:text-accent-300"
        >
          Ver archivo actual
        </a>
      )}
      {error && <span className="mt-1.5 block text-[13px] text-danger-500">{error}</span>}
    </div>
  );
};
