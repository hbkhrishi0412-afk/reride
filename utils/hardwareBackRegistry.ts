/** Lets mobile screens intercept Android hardware back before app-level navigation. */
let handler: (() => boolean) | null = null;

export function setHardwareBackHandler(next: (() => boolean) | null): void {
  handler = next;
}

/** @returns true if the active screen consumed the back press */
export function tryHardwareBack(): boolean {
  return handler?.() ?? false;
}
