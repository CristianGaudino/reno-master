import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * A dialog.
 *
 * Built on `<dialog>` so focus trapping, the backdrop and Escape all come from
 * the platform rather than being reimplemented — the usual hand-rolled version
 * of this is where keyboard users get stranded.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Clicking the backdrop closes. The dialog element's own box is the
      // backdrop's only child, so a hit on the element itself is a backdrop hit.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,32rem)] rounded-lg border border-border bg-surface-raised p-0",
        "text-ink backdrop:bg-black/40",
        wide && "w-[min(94vw,52rem)]",
      )}
    >
      {/*
        Contents exist only while the dialog is open. A closed `<dialog>` is
        display:none so nothing is visible either way, but leaving a second copy
        of every form field in the DOM gives the page duplicate labelled inputs —
        which confuses anything walking it by label rather than by sight.
      */}
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="shrink-0 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-xs leading-snug text-ink-muted">
                {description}
              </p>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {children}
          </div>

          {footer && (
            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
