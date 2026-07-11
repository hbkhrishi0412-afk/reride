import React, { useEffect, useRef } from 'react';
import { useFocusTrap } from '../../utils/focusTrap';
import { Z_INDEX } from '../../utils/zIndex';

type ModalShellProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Applied to the outer fixed overlay */
  overlayClassName?: string;
  /** Applied to the centered panel wrapper */
  panelWrapperClassName?: string;
  'aria-label'?: string;
};

/** Accessible modal shell with focus trap and Escape to close. */
export function ModalShell({
  isOpen,
  onClose,
  children,
  overlayClassName = 'fixed inset-0 flex items-center justify-center p-4 bg-black/50',
  panelWrapperClassName = 'relative w-full max-h-[90vh] flex items-center justify-center outline-none',
  'aria-label': ariaLabel = 'Close dialog',
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={overlayClassName}
      style={{ zIndex: Z_INDEX.modal }}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={ariaLabel}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={panelWrapperClassName}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
