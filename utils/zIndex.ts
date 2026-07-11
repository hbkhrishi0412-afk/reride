/**
 * Central z-index scale — keep all overlays within this range.
 * Avoid values >200; some WebViews mishandle extreme z-index.
 */
export const Z_INDEX = {
  bottomNav: 40,
  stickyHeader: 40,
  floatingAction: 50,
  chatMinimized: 90,
  chatExpanded: 100,
  modalBackdrop: 105,
  modal: 110,
  toast: 120,
  commandPalette: 130,
  skipLink: 10000,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;
