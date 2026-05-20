/**
 * Module-level pub/sub for RPC reply notifications delivered over WebSocket.
 *
 * When the backend sends an `rpc.reply` WS message for a given requestId, the
 * WS handler calls `notifyRPCReady(requestId)`.  Any concurrent `rpcCall` that
 * is waiting for that requestId will be woken up immediately so it can fetch
 * the reply via HTTP without waiting for the next fallback-poll interval.
 */

type ReadyCallback = () => void;

const _listeners = new Map<string, ReadyCallback>();

/** Register a one-shot callback that fires when `requestId` is ready. */
export function subscribeRPCReady(requestId: string, fn: ReadyCallback): () => void {
  _listeners.set(requestId, fn);
  return () => _listeners.delete(requestId);
}

/** Called by the WebSocket handler when an `rpc.reply` message arrives. */
export function notifyRPCReady(requestId: string): void {
  const fn = _listeners.get(requestId);
  if (fn) {
    _listeners.delete(requestId);
    fn();
  }
}
