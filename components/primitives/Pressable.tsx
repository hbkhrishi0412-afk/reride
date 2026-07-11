import React, { useRef } from 'react';
import { useFocusTrap } from '../../utils/focusTrap';
import { Z_INDEX } from '../../utils/zIndex';

type PressableProps = {
  onPress?: (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'data-testid'?: string;
};

/**
 * Accessible replacement for clickable <div> — keyboard + screen-reader friendly.
 */
export function Pressable({
  onPress,
  children,
  className,
  disabled = false,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: PressableProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !onPress) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPress(event);
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      data-testid={testId}
      className={className}
      onClick={disabled ? undefined : onPress}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

type ModalBackdropProps = {
  onClose: () => void;
  className?: string;
  backdropClassName?: string;
  children: React.ReactNode;
  'aria-label'?: string;
};

/** Modal overlay: backdrop button + content panel with focus trap. */
export function ModalBackdrop({
  onClose,
  className = `fixed inset-0 flex items-center justify-center p-4`,
  backdropClassName = 'absolute inset-0 bg-black/60',
  children,
  'aria-label': ariaLabel = 'Close dialog',
}: ModalBackdropProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  return (
    <div
      className={className}
      style={{ zIndex: Z_INDEX.modal }}
      role="presentation"
    >
      <button
        type="button"
        className={backdropClassName}
        aria-label={ariaLabel}
        onClick={onClose}
      />
      <div className="relative z-10 max-h-full w-full flex items-center justify-center pointer-events-none">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          className="pointer-events-auto outline-none"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
