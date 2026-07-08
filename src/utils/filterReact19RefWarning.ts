const FILTERED_WARNINGS = [
  'Accessing element.ref was removed in React 19',
  'Each child in a list should have a unique "key" prop',
];

export function filterReact19RefWarning() {
  if (typeof console === 'undefined') {
    return;
  }
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && FILTERED_WARNINGS.some((w) => first.includes(w))) {
      return;
    }
    originalError(...args);
  };
}
