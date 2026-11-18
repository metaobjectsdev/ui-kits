/** Joins class names, skipping empty ones. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

/**
 * True when a node renders something. `cond && <X/>` passes false when the condition fails,
 * and an empty string renders nothing, so neither should leave an empty wrapper behind.
 */
export function has(node: unknown): boolean {
  return node != null && node !== false && node !== true && node !== '';
}
