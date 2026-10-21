import { useCallback, useEffect, useRef, useState } from 'react';
import type { OfficeEvent, ProviderStatus, Run, ProjectSession, SchedulingStatus } from '../shared/contracts';
import { api, errorMessage, mergeEvents } from './api';

export type Connection = 'idle' | 'connecting' | 'live' | 'reconnecting';

export function useOffice() {
  const [scheduling, setScheduling] = useState<SchedulingStatus | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [sessions, setSessions] = useState<ProjectSession[]>([]);
  const [sessionFilter, setSessionFilter] = useState('');
  const [sessionCursor, setSessionCursor] = useState<string | null>(null);
  const [selectedId, selectRun] = useState<string | null>(null);
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [connection, setConnection] = useState<Connection>('idle');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  const filterRef = useRef(sessionFilter);
  filterRef.current = sessionFilter;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const upsertRun = useCallback((run: Run) => {
    if (!mounted.current) return;
    if (filterRef.current && run.sessionId !== filterRef.current) return;
    setRuns(current => {
      const previous = current.find(item => item.id === run.id);
      if (previous && previous.version > run.version) return current;
      return [run, ...current.filter(item => item.id !== run.id)]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await api.session(controller.signal);
        const [providerResponse, runResponse, sessionsResponse, schedulingResponse] = await Promise.all([api.providers(controller.signal), api.runs(controller.signal, sessionFilter), api.projectSessions(controller.signal), api.scheduling(controller.signal)]);
        if (controller.signal.aborted) return;
        setProviders(providerResponse.data); setScheduling(schedulingResponse.data);
        setRuns(runResponse.data);
        setSessions(sessionsResponse.data); setSessionCursor(sessionsResponse.meta.nextCursor);
        selectRun(current => current && runResponse.data.some(run => run.id === current) ? current : runResponse.data[0]?.id ?? null);
      } catch (failure) {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [revision, sessionFilter]);

  useEffect(() => {
    setEvents([]);
    setEventError(null);
    if (!selectedId) { setConnection('idle'); setDetailLoading(false); return; }
    const id = selectedId;
    const controller = new AbortController();
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let sequence = 0;
    let fetchingSnapshot = false;
    let snapshotRequested = false;
    setDetailLoading(true);
    setConnection('connecting');

    async function replayEvents(after: number) {
      let cursor = after;
      let more = true;
      while (more && !controller.signal.aborted) {
        const page = await api.events(id, cursor, controller.signal);
        if (controller.signal.aborted) return;
        setEvents(current => mergeEvents(current, page.data));
        const next = page.data.at(-1)?.sequence;
        more = page.meta.nextCursor !== null && next !== undefined && next > cursor;
        if (next !== undefined) {
          cursor = Math.max(cursor, next);
          sequence = Math.max(sequence, next);
        }
      }
    }

    async function fetchSnapshot() {
      snapshotRequested = true;
      if (fetchingSnapshot) return;
      fetchingSnapshot = true;
      try {
        while (snapshotRequested && !controller.signal.aborted) {
          snapshotRequested = false;
          const result = await api.run(id, controller.signal);
          if (!controller.signal.aborted) upsertRun(result.data);
        }
      } catch (failure) {
        if (!controller.signal.aborted) setEventError(errorMessage(failure));
      } finally { fetchingSnapshot = false; }
    }

    function connect() {
      if (controller.signal.aborted) return;
      const url = new URL('/api/events', window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(url);
      socket.onopen = () => {
        if (controller.signal.aborted) return;
        failures = 0;
        setConnection('live');
        setEventError(null);
        const resumeFrom = sequence;
        socket?.send(JSON.stringify({ runId: id, afterSequence: resumeFrom }));
        // HTTP pagination fills a disconnect gap larger than the socket's replay window.
        void replayEvents(resumeFrom).catch(failure => {
          if (!controller.signal.aborted) setEventError(errorMessage(failure));
        });
        void fetchSnapshot();
      };
      socket.onmessage = message => {
        if (controller.signal.aborted) return;
        try {
          const item = JSON.parse(String(message.data)) as OfficeEvent | { type: 'snapshot'; run: Run } | { type: 'error'; message: string };
          if (item.type === 'snapshot' && 'run' in item) {
            if (item.run.id === id) upsertRun(item.run);
          } else if (item.type === 'error' && 'message' in item) {
            setEventError(item.message);
          } else if ('sequence' in item && item.runId === id) {
            sequence = Math.max(sequence, item.sequence);
            setEvents(current => mergeEvents(current, [item]));
            void fetchSnapshot();
          }
        } catch { setEventError('Không đọc được một sự kiện. Hãy tải lại để đồng bộ.'); }
      };
      socket.onerror = () => { if (!controller.signal.aborted) setConnection('reconnecting'); };
      socket.onclose = () => {
        if (controller.signal.aborted) return;
        setConnection('reconnecting');
        timer = setTimeout(connect, Math.min(15_000, 1000 * 2 ** failures++));
      };
    }

    void (async () => {
      try {
        const result = await api.run(id, controller.signal);
        if (controller.signal.aborted) return;
        upsertRun(result.data);
        await replayEvents(0);
        connect();
      } catch (failure) {
        if (!controller.signal.aborted) { setEventError(errorMessage(failure)); setConnection('reconnecting'); timer = setTimeout(connect, 1500); }
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(timer);
      if (socket) { socket.onclose = null; socket.close(); }
    };
  }, [selectedId, revision, upsertRun]);

  return { scheduling,
    sessions, sessionFilter, sessionCursor,
    filterSession: (id: string) => { selectRun(null); setRuns([]); setSessionFilter(id); },
    loadMoreSessions: async () => {
      if (!sessionCursor) return;
      try {
        const result = await api.projectSessions(undefined, sessionCursor);
        if (!mounted.current) return;
        setSessions(current => [...new Map([...current, ...result.data].map(session => [session.id, session])).values()]); setSessionCursor(result.meta.nextCursor);
      } catch (failure) { if (mounted.current) setError(errorMessage(failure)); }
    },
    showCreated: (run: Run) => { setSessionFilter(run.sessionId ?? ''); setRuns([run]); selectRun(run.id); setRevision(value => value + 1); },
    runs, providers, selectedId, selectRun, run: runs.find(run => run.id === selectedId) ?? null,
    events, connection, loading, detailLoading, error, eventError, upsertRun,
    refresh: () => setRevision(value => value + 1),
  };
}
