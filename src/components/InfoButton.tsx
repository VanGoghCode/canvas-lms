import { useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Shared, touch- and keyboard-accessible help. Long copy never relies on hover. */
export function InfoButton({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="info-button"
        aria-label={`About ${title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10">
          <circle cx="5" cy="2" r="0.8" fill="currentColor" />
          <path d="M5 4.2v3.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          id={id}
          className="info-dialog"
          aria-labelledby={`${id}-title`}
          onClose={() => {
            setOpen(false);
            trigger.current?.focus({ preventScroll: true });
          }}
          onClick={(event) => {
            if (event.target === dialog.current) {
              const bounds = dialog.current!.getBoundingClientRect();
              if (
                event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY < bounds.top ||
                event.clientY > bounds.bottom
              )
                dialog.current?.close();
            }
          }}
        >
          <div className="section-heading">
            <h2 id={`${id}-title`}>{title}</h2>
            <button
              type="button"
              className="info-close"
              aria-label="Close information"
              autoFocus
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </div>
          <div className="info-content">{children}</div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
