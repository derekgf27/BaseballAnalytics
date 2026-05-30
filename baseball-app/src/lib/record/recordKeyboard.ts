export function isTypingInFormField(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[data-record-shortcuts-ignore]")) return true;
  return false;
}

export function throwsToPitcherHand(t: "L" | "R" | "S" | null | undefined): "L" | "R" | null {
  if (t === "L" || t === "R") return t;
  return null;
}
