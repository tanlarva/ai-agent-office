import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttentionItem } from '../shared/contracts';
import { api } from './api';

const baseTitle = document.title;
const storageKey = 'office.notify';
function readPreference(): boolean {
  try { return localStorage.getItem(storageKey) === 'on'; } catch { return false; }
}
function chime() {
  // Two short soft tones; created on demand so no audio context exists until something needs attention.
  try {
    const context = new AudioContext();
    for (const [index, frequency] of [660, 880].entries()) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.frequency.value = frequency; oscillator.type = 'sine';
      const start = context.currentTime + index * 0.16;
      gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + 0.26);
    }
    setTimeout(() => void context.close(), 800);
  } catch { /* Audio is optional. */ }
}

/** Pending questions/approvals across runs, delivered over an unsubscribed socket that only receives attention pings. */
export function useAttention(onOpen: (item: AttentionItem) => void) {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [toast, setToast] = useState<AttentionItem | null>(null);
  const [enabled, setEnabled] = useState(readPreference);
  const known = useRef(new Set<string>());
  const first = useRef(true);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api.attention(signal);
      if (signal?.aborted) return;
      const fresh = result.data.filter(item => !known.current.has(item.id));
      known.current = new Set(result.data.map(item => item.id));
      setItems(result.data);
      setToast(current => current && result.data.some(item => item.id === current.id) ? current : null);
      // The first load is a snapshot: list it, but do not ring for requests the user may already know.
      if (fresh.length && !first.current) {
        const item = fresh[0]!;
        setToast(item);
        chime();
        if (enabledRef.current && 'Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
          const notification = new Notification(item.kind === 'inquiry' ? `${item.role} đang hỏi bạn` : `${item.role} cần phê duyệt`, { body: item.title, tag: item.id });
          notification.onclick = () => { window.focus(); openRef.current(item); notification.close(); };
        }
      }
      first.current = false;
    } catch { /* The main connection banner reports backend failures. */ }
  }, []);

  useEffect(() => {
    document.title = items.length ? `(${items.length}) Cần bạn trả lời · ${baseTitle}` : baseTitle;
  }, [items.length]);

  useEffect(() => {
    const controller = new AbortController();
    let socket: WebSocket | undefined, timer: ReturnType<typeof setTimeout> | undefined, failures = 0;
    function connect() {
      if (controller.signal.aborted) return;
      const url = new URL('/api/events', window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(url);
      socket.onopen = () => { failures = 0; void refresh(controller.signal); };
      socket.onmessage = message => {
        try { if ((JSON.parse(String(message.data)) as { type?: string }).type === 'attention') void refresh(controller.signal); } catch { /* Ignore malformed frames. */ }
      };
      socket.onclose = () => { if (!controller.signal.aborted) timer = setTimeout(connect, Math.min(15_000, 1000 * 2 ** failures++)); };
    }
    // Session cookie is bootstrapped by useOffice; a short delay avoids racing the first request.
    timer = setTimeout(connect, 400);
    // Polling fallback keeps the inbox right if a socket frame is missed.
    const poll = setInterval(() => void refresh(controller.signal), 20_000);
    return () => { controller.abort(); clearTimeout(timer); clearInterval(poll); if (socket) { socket.onclose = null; socket.close(); } };
  }, [refresh]);

  async function enable() {
    if (!('Notification' in window)) return;
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    const on = permission === 'granted';
    setEnabled(on);
    try { localStorage.setItem(storageKey, on ? 'on' : 'off'); } catch { /* Preference is optional. */ }
  }
  function disable() { setEnabled(false); try { localStorage.setItem(storageKey, 'off'); } catch { /* optional */ } }
  return { items, toast, dismissToast: () => setToast(null), refresh, notifications: { enabled, supported: 'Notification' in window, enable, disable } };
}
