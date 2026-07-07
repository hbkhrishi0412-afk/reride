/**
 * Scroll inside a scrollable container without moving the document viewport.
 * `Element.scrollIntoView()` walks ancestor scrollers including `window`, which
 * pulls vehicle detail pages down when chat auto-scrolls.
 */
export function scrollContainerToShowElement(
  container: HTMLElement,
  target: HTMLElement,
  options?: { block?: 'start' | 'center' | 'end'; behavior?: ScrollBehavior },
): void {
  const behavior = options?.behavior ?? 'smooth';
  const block = options?.block ?? 'end';
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const relativeTop = targetRect.top - containerRect.top + container.scrollTop;

  if (block === 'center') {
    container.scrollTo({
      top: Math.max(0, relativeTop - container.clientHeight / 2 + targetRect.height / 2),
      behavior,
    });
    return;
  }
  if (block === 'start') {
    container.scrollTo({ top: Math.max(0, relativeTop), behavior });
    return;
  }
  container.scrollTo({
    top: Math.max(0, relativeTop - container.clientHeight + targetRect.height),
    behavior,
  });
}

export function scrollContainerToBottom(
  container: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
): void {
  container.scrollTo({ top: container.scrollHeight, behavior });
}
