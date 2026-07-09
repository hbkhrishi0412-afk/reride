import React from 'react';

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

/** Modal overlay: backdrop button + content panel. */
export function ModalBackdrop({
  onClose,
  className = 'fixed inset-0 flex items-center justify-center z-50 p-4',
  backdropClassName = 'absolute inset-0 bg-black/60',
  children,
  'aria-label': ariaLabel = 'Close dialog',
}: ModalBackdropProps) {
  return (
    <div className={className}>
      <button
        type="button"
        className={backdropClassName}
        aria-label={ariaLabel}
        onClick={onClose}
      />
      <div className="relative z-10 max-h-full w-full flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );
}
