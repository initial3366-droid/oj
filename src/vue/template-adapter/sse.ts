// QOJ realtime workflows use their existing STOMP clients. The template's
// tenant/notice SSE service is not part of QOJ's API contract.
export function useSse() {
  return { on<T>(_topic: string, _handler: (data: T) => void) { return () => {}; } };
}
