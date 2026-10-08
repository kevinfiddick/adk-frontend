/** Joins class names, skipping empty ones. It does not resolve conflicting Tailwind classes, so avoid passing two that set the same property. */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
