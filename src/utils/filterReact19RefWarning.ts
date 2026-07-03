const REACT_19_REF_WARNING = 'Accessing element.ref was removed in React 19';

export function filterReact19RefWarning() {
  if (typeof console === 'undefined') {
    return;
  }
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && first.includes(REACT_19_REF_WARNING)) {
      return;
    }
    originalError(...args);
  };
}
