import { getAuthToken } from "./auth";

export type DeviceWsMessage = {
  type?: string;
  payload?: unknown;
  online?: boolean;
};

type Listener = (msg: DeviceWsMessage) => void;

interface Connection {
  ws: WebSocket;
  listeners: Set<Listener>;
}

function buildWsUrl(serialNo: string): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  let wsBase: string;
  if (configured !== undefined) {
    const httpBase = configured.trim().replace(/\/$/, "");
    if (httpBase === "") {
      // Same-origin: derive WebSocket scheme and host from window.location
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsBase = `${proto}//${window.location.host}`;
    } else if (httpBase.startsWith("https://")) {
      wsBase = `wss://${httpBase.slice(8)}`;
    } else if (httpBase.startsWith("http://")) {
      wsBase = `ws://${httpBase.slice(7)}`;
    } else {
      wsBase = httpBase;
    }
  } else {
    wsBase = "ws://127.0.0.1:18081";
  }
  const token = getAuthToken() ?? "";
  return `${wsBase}/api/ws/devices/${encodeURIComponent(serialNo)}?token=${encodeURIComponent(token)}`;
}

const _connections = new Map<string, Connection>();

/**
 * Subscribe to device WebSocket messages. Returns an unsubscribe function.
 * Connections are shared and ref-counted — if multiple callers subscribe to the
 * same serialNo, only one WebSocket is opened. The socket closes automatically
 * when all subscribers unsubscribe.
 */
export function subscribeDeviceWs(serialNo: string, listener: Listener): () => void {
  if (!serialNo) return () => {};

  let conn = _connections.get(serialNo);

  if (!conn) {
    const listeners = new Set<Listener>();
    const ws = new WebSocket(buildWsUrl(serialNo));
    conn = { ws, listeners };
    _connections.set(serialNo, conn);

    const thisConn = conn;
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as DeviceWsMessage;
        for (const fn of thisConn.listeners) fn(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (_connections.get(serialNo) === thisConn) {
        _connections.delete(serialNo);
      }
    };
  }

  conn.listeners.add(listener);

  return () => {
    const c = _connections.get(serialNo);
    if (!c) return;
    c.listeners.delete(listener);
    if (c.listeners.size === 0) {
      c.ws.close();
      _connections.delete(serialNo);
    }
  };
}
