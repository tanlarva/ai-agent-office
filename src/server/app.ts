import Fastify, { LogController } from 'fastify';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { approvalDecisionSchema, createRunSchema, createProjectSessionSchema, inquiryAnswerSchema, providerIdSchema, retryRunSchema, userNoteSchema, type OfficeEvent, type ProviderId, type ProviderStatus } from '../shared/contracts.js';
import { ProjectSessions } from './project-sessions.js';
import { FolderBrowser } from './folders.js';
import { OfficeError } from './errors.js';
import { Runtime } from './runtime.js';
import type { Store } from './store.js';
import type { Provider, ProviderMap } from './provider.js';
import { schedulingFromEnv, type SchedulingOptions } from './scheduling.js';

export async function createApp(options: { root: string; store: Store; provider?: Provider; providers?: ProviderMap; port?: number; logger?: boolean; timeoutMs?: number; scheduling?: SchedulingOptions }) {
  const port = options.port ?? 4310;
  const app = Fastify({ logger: options.logger ? { redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers.x-csrf-token'], serializers: { req: req => ({ method: req.method, url: req.url?.split('?')[0] }) } } : false, bodyLimit: 32_000, logController: new LogController({ disableRequestLogging: true }) });
  const providers: ProviderMap = options.providers ?? (options.provider ? { [options.provider.id ?? 'codex']: options.provider } : {});
  const runtime = new Runtime(options.store, providers, { appRoot: options.root, allowedRoot: process.env.OFFICE_WORKSPACE_ROOT, timeoutMs: options.timeoutMs, scheduling: options.scheduling ?? schedulingFromEnv(process.env) });
  await runtime.recover();
  const projectSessions = new ProjectSessions(options.store, options.root, process.env.OFFICE_WORKSPACE_ROOT);
  const folders = new FolderBrowser(options.root, process.env.OFFICE_WORKSPACE_ROOT);
  const session = randomBytes(32).toString('hex'), csrfToken = randomBytes(32).toString('hex');
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, '127.0.0.1:5173', 'localhost:5173']);
  const origins = new Set([...hosts].map(host => `http://${host}`));
  const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const envelope = <T>(data: T, traceId: string) => ({ data, meta: { traceId } });
  const pageQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), cursor: z.string().uuid().optional() });
  const eventQuery = z.object({ after: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(200).default(100) });
  const statusCache = new Map<ProviderId, { value: ProviderStatus; time: number }>();
  const statusPending = new Map<ProviderId, Promise<ProviderStatus>>();
  const status = async (id: ProviderId) => {
    const cached = statusCache.get(id);
    if (cached && Date.now() - cached.time < 15_000) return cached.value;
    let pending = statusPending.get(id);
    if (!pending) {
      pending = providers[id]!.status().then(value => { statusCache.set(id, { value, time: Date.now() }); return value; }).finally(() => { statusPending.delete(id); });
      statusPending.set(id, pending);
    }
    return pending;
  };
  app.addHook('onRequest', async (request, reply) => {
    if (!hosts.has(request.headers.host ?? '') || (request.headers.origin && !origins.has(request.headers.origin)))
      throw new OfficeError('ORIGIN_FORBIDDEN', 'Origin hoặc Host không được phép.', 403);
    if (!request.url.startsWith('/api/')) return;
    const isSocket = request.url.split('?')[0] === '/api/events' && request.headers.upgrade?.toLowerCase() === 'websocket';
    if (!isSocket && request.headers['x-office-client'] !== 'browser') throw new OfficeError('CLIENT_REQUIRED', 'Thiếu thông tin client local.', 403);
    if (request.url === '/api/session' && request.method === 'GET') return;
    const cookie = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('office_session='))?.slice('office_session='.length) ?? '';
    if (!equal(cookie, session)) throw new OfficeError('SESSION_REQUIRED', 'Phiên local đã hết hạn. Tải lại trang.', 401);
    if (isSocket && !request.headers.origin) throw new OfficeError('ORIGIN_REQUIRED', 'WebSocket yêu cầu origin.', 403);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !equal(String(request.headers['x-csrf-token'] ?? ''), csrfToken))
      throw new OfficeError('CSRF_INVALID', 'Phiên bảo vệ thao tác không hợp lệ. Tải lại trang.', 403);
    reply.header('Cache-Control', 'no-store');
  });
  app.addHook('onSend', async (_request, reply, payload) => {
    // GLTFLoader decodes embedded local VRM textures through blob URLs (ImageBitmap/HTMLImage).
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer')
      .header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: ws://127.0.0.1:* ws://localhost:*; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'");
    return payload;
  });
  app.setErrorHandler((error, request, reply) => {
    const known = error instanceof OfficeError;
    const validation = error instanceof z.ZodError;
    const candidate = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined;
    const statusCode = known ? error.status : validation ? 400 : (typeof candidate === 'number' && candidate >= 400 && candidate < 500) ? candidate : 500;
    const code = known ? error.code : validation ? 'VALIDATION_ERROR' : 'REQUEST_FAILED';
    request.log.error({ traceId: request.id, code, statusCode }, 'Request failed');
    void reply.code(statusCode).send({ error: { code, message: known ? error.message : validation ? 'Dữ liệu không hợp lệ. Kiểm tra các trường nhập.' : 'Không thể xử lý yêu cầu.' }, traceId: request.id });
  });
  app.addHook('onResponse', async (request, reply) => { request.log.info({ traceId: request.id, method: request.method, status: reply.statusCode, durationMs: reply.elapsedTime }, 'Request completed'); });
  app.get('/api/session', async (request, reply) => {
    reply.header('Set-Cookie', `office_session=${session}; HttpOnly; SameSite=Strict; Path=/`);
    reply.header('Cache-Control', 'no-store'); return envelope({ csrfToken }, request.id);
  });
  app.get('/api/providers', async request => envelope(await Promise.all(runtime.providerIds().map(status)), request.id));
  app.get('/api/scheduling', async request => {
    const query = z.object({ provider: providerIdSchema.default('codex') }).parse(request.query);
    return envelope(await runtime.governorFor(query.provider).status(), request.id);
  });
  app.get('/api/attention', async request => envelope(runtime.attention(), request.id));
  app.get('/api/runs', async request => {
    const query = pageQuery.extend({ sessionId: z.string().uuid().optional() }).parse(request.query);
    const rows = await options.store.list(query.limit + 1, query.cursor, query.sessionId);
    return { data: rows.slice(0, query.limit), meta: { traceId: request.id, nextCursor: rows.length > query.limit ? rows[query.limit - 1]?.id ?? null : null } };
  });
  app.get('/api/project-sessions', async request => {
    const query = pageQuery.parse(request.query);
    const rows = await options.store.sessions(query.limit + 1, query.cursor);
    return { data: rows.slice(0, query.limit), meta: { traceId: request.id, nextCursor: rows.length > query.limit ? rows[query.limit - 1]?.id ?? null : null } };
  });
  app.post('/api/project-sessions', async (request, reply) => {
    const input = createProjectSessionSchema.parse(request.body);
    const key = z.string().uuid().parse(request.headers['idempotency-key']);
    return reply.code(201).send(envelope(await projectSessions.create(input, key), request.id));
  });
  app.get('/api/workspace-folders', async request => {
    const query = z.object({ path: z.string().min(1).max(500).optional(), cursor: z.coerce.number().int().min(0).max(10_000).default(0), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query);
    return envelope(await folders.list(query.path, query.cursor, query.limit), request.id);
  });
  app.post('/api/runs', async (request, reply) => {
    const input = createRunSchema.parse(request.body);
    const key = z.string().uuid().parse(request.headers['idempotency-key']);
    const run = await runtime.create(input, key);
    return reply.code(201).header('Location', `/api/runs/${run.id}`).send(envelope(run, request.id));
  });
  const runId = (params: unknown) => z.object({ id: z.string().uuid() }).parse(params).id;
  const requireRun = async (id: string) => {
    const run = await options.store.get(id);
    if (!run) throw new OfficeError('RUN_NOT_FOUND', 'Không tìm thấy run.', 404); return run;
  };
  app.get('/api/runs/:id', async request => envelope(await requireRun(runId(request.params)), request.id));
  app.post('/api/runs/:id/retries', async (request, reply) => {
    const input = retryRunSchema.parse(request.body);
    const key = z.string().uuid().parse(request.headers['idempotency-key']);
    const run = await runtime.retry(runId(request.params), input.version, key);
    return reply.code(201).header('Location', `/api/runs/${run.id}`).send(envelope(run, request.id));
  });
  app.get('/api/runs/:id/events', async request => {
    const id = runId(request.params); await requireRun(id);
    const query = eventQuery.parse(request.query);
    const events = await options.store.events(id, query.after, query.limit + 1);
    return { data: events.slice(0, query.limit), meta: { traceId: request.id, nextCursor: events.length > query.limit ? String(events[query.limit - 1]?.sequence) : null } };
  });
  app.post('/api/runs/:id/cancellations', async (request, reply) => reply.code(202).send(envelope(await runtime.cancel(runId(request.params)), request.id)));
  app.post('/api/runs/:id/notes', async (request, reply) => {
    const input = userNoteSchema.parse(request.body);
    return reply.code(201).send(envelope(await runtime.note(runId(request.params), input.text, input.mode), request.id));
  });
  app.post('/api/inquiries/:id/answers', async request => {
    const input = inquiryAnswerSchema.parse(request.body);
    return envelope(await runtime.answer(runId(request.params), input), request.id);
  });
  app.post('/api/approvals/:id/decisions', async request => {
    const input = approvalDecisionSchema.parse(request.body);
    return envelope(await runtime.decide(runId(request.params), input.decision, input.version), request.id);
  });
  const attentionEvents = new Set(['inquiry.requested', 'approval.requested', 'inquiry.answered', 'approval.resolved', 'request.expired', 'run.completed']);
  await app.register(websocket, { options: { maxPayload: 4096 } });
  app.get('/api/events', { websocket: true }, socket => {
    let subscribed: string | null = null;
    const send = (value: unknown) => { if (socket.readyState === 1) { if (socket.bufferedAmount > 1_000_000) socket.close(1013, 'Slow client'); else socket.send(JSON.stringify(value)); } };
    // Questions and approvals reach every open tab so the user is notified even while viewing another run.
    const listener = (event: OfficeEvent) => {
      if (event.runId === subscribed) send(event);
      else if (attentionEvents.has(event.type)) send({ type: 'attention', runId: event.runId, event: event.type });
    };
    runtime.on('event', listener);
    socket.on('close', () => runtime.off('event', listener));
    socket.on('error', () => runtime.off('event', listener));
    socket.on('message', (data: Buffer) => {
      void (async () => {
        const query = z.object({ runId: z.string().uuid(), afterSequence: z.number().int().min(0).default(0) }).strict().parse(JSON.parse(data.toString()));
        // Subscribe before reading the snapshot. Duplicates are expected and identified by eventId/sequence.
        subscribed = query.runId;
        const run = await requireRun(query.runId);
        for (const event of await options.store.events(query.runId, query.afterSequence, 200)) send(event);
        send({ type: 'snapshot', run });
      })().catch(() => { send({ type: 'error', message: 'Không thể đăng ký run này.' }); socket.close(1008); });
    });
  });
  try {
    const webRoot = join(options.root, 'dist', 'web'); await access(join(webRoot, 'index.html'));
    await app.register(staticFiles, { root: webRoot });
    app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/') ? reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy endpoint.' }, traceId: request.id }) : reply.sendFile('index.html'));
  } catch { /* Before frontend build, use Vite at 127.0.0.1:5173. */ }
  runtime.on('runtime_error', () => app.log.error({ code: 'PERSISTENCE_FAILURE' }, 'Runtime failure; inspect database availability'));
  app.addHook('onClose', async () => { await runtime.close(); await options.store.close(); });
  return { app, runtime };
}
