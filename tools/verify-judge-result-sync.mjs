// Repeatable integration scenarios against the production API and page watcher.
// Transport and timers are controlled so slow/stale/error races are deterministic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const requests = [];
const apiContext = {
  exports: {},
  require: (name) => name === './client' ? {
    apiGet: (url) => { const task = deferred(); requests.push({ url, ...task }); return task.promise; },
  } : {},
};
vm.runInNewContext(compile(fs.readFileSync('src/api/submission.ts', 'utf8')), apiContext);
const fetchDetail = apiContext.exports.fetchSubmissionDetail;
const first = fetchDetail(7), duplicate = fetchDetail(7), other = fetchDetail(8);
check('same ID shares one in-flight request; different IDs remain independent', () => assert.equal(requests.length, 2));
requests[0].resolve({ id: 7, status: 'RUNNING' }); requests[1].resolve({ id: 8, status: 'WA' });
await Promise.all([first, duplicate, other]);
const retry = fetchDetail(7);
check('successful requests are evicted rather than cached', () => assert.equal(requests.length, 3));
requests[2].reject(new Error('network'));
await retry.catch(() => {});
const recovered = fetchDetail(7);
check('failed requests are evicted for retry', () => assert.equal(requests.length, 4));
requests[3].resolve({ id: 7, status: 'AC' }); await recovered;

const page = fs.readFileSync('src/pages/PracticePage.tsx', 'utf8');
const statusSource = page.slice(page.indexOf('function isRunningSubmissionStatus'), page.indexOf('function maxSubmissionCaseMetric'));
const watcherSource = page.slice(page.indexOf('  const startSubmissionWatcher ='), page.indexOf('  const startDebugResize ='));
function fixture({ lateSubscription = false, rejectSubscription = false } = {}) {
  const timers = new Map(); const delays = []; const alerts = []; const loads = [];
  const subscription = deferred(); let callback, unsubscribed = 0, finished = 0, timerId = 0;
  const context = {
    exports: {},
    window: {
      setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, fn); delays.push(delay); return id; },
      clearTimeout: (id) => timers.delete(id),
      setInterval: () => { throw new Error('fixed interval polling is forbidden'); },
      clearInterval: (id) => timers.delete(id),
    },
    submissionWatcherCleanupRef: { current: null }, codeActionInFlightRef: { current: true },
    setSubmitLoading: (loading) => { if (!loading) finished++; },
    setDebugAlert: (value) => alerts.push(value), formatSubmissionAlert: (detail) => detail,
    fetchSubmissionDetail: () => { const task = deferred(); loads.push(task); return task.promise; },
    wsClient: { subscribeToSubmission: (_id, cb) => { callback = cb; return subscription.promise; } },
  };
  vm.runInNewContext(compile(`${statusSource}\n${watcherSource}\nexports.start = startSubmissionWatcher; exports.isFinal = isFinalSubmissionStatus;`), context);
  context.exports.start(7);
  if (rejectSubscription) subscription.reject(new Error('offline'));
  else if (!lateSubscription) subscription.resolve(() => unsubscribed++);
  return { context, timers, delays, loads, alerts, emit: (status) => callback({ submissionId: 7, status }),
    resolveSubscription: () => subscription.resolve(() => unsubscribed++),
    stats: () => ({ unsubscribed, finished }),
    tick: () => { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); },
  };
}
const f = fixture(); await flush();
for (const status of ['WAITING', 'Pending', 'RUNNING', 'JUDGING', 'COMPILING', 'REJUDGE_PENDING', 'QUEUED', '', 'UNKNOWN']) {
  check(`nonterminal ${status || '(empty)'}`, () => assert.equal(f.context.exports.isFinal(status), false));
}
for (const status of ['AC', 'Accepted', 'WA', 'Wrong Answer', 'TLE', 'Time Limit Exceeded', 'MLE', 'RE', 'CE', 'NOO', 'SE', 'FAILED']) {
  check(`terminal ${status}`, () => assert.equal(f.context.exports.isFinal(status), true));
}
f.emit('RUNNING'); f.emit('PENDING');
check('WebSocket bursts join a pending details request', () => assert.equal(f.loads.length, 1));
f.tick(); await flush();
check('slow poll joins pending request', () => assert.equal(f.loads.length, 1));
f.emit('AC'); f.loads[0].resolve({ id: 7, status: 'RUNNING' }); await flush();
check('terminal event overlapping stale GET requests a fresh confirmation', () => assert.equal(f.loads.length, 2));
check('stale details do not stop watcher', () => assert.equal(f.stats().finished, 0));
f.loads[1].reject(new Error('transient')); await flush();
check('failed final confirmation retains polling/subscription', () => { assert.equal(f.stats().unsubscribed, 0); assert.equal(f.timers.size, 1); });
f.tick(); f.loads[2].resolve({ id: 7, status: 'AC', cases: [{ status: 'AC' }] }); await flush();
check('final details cancel polling and unsubscribe immediately', () => { assert.equal(f.stats().finished, 1); assert.equal(f.stats().unsubscribed, 1); assert.equal(f.timers.size, 0); assert.equal(f.alerts.at(-1).cases.length, 1); });
f.emit('RUNNING'); await flush();
check('late messages cannot revive a stopped watcher', () => assert.equal(f.loads.length, 3));

const jitter = fixture(); await flush(); jitter.loads[0].resolve({ status: 'RUNNING' }); await flush();
for (let i = 0; i < 12; i++) { jitter.tick(); jitter.loads.at(-1).resolve({ status: 'RUNNING' }); await flush(); }
check('poll delays stay within 1600–2400 ms and vary', () => { assert.ok(jitter.delays.every(d => d >= 1600 && d <= 2400)); assert.ok(new Set(jitter.delays).size > 1); });
jitter.context.submissionWatcherCleanupRef.current();
const late = fixture({ lateSubscription: true }); late.loads[0].resolve({ status: 'WA' }); await flush(); late.resolveSubscription(); await flush();
check('subscription resolving after final details is disposed', () => assert.equal(late.stats().unsubscribed, 1));
const unmounted = fixture(); await flush(); unmounted.context.submissionWatcherCleanupRef.current(); unmounted.loads[0].resolve({ status: 'AC' }); await flush();
check('late GET after unmount does not update UI', () => assert.equal(unmounted.alerts.length, 0));
const offline = fixture({ rejectSubscription: true }); await flush(); offline.loads[0].resolve({ status: 'RUNNING' }); await flush(); offline.tick(); offline.loads[1].resolve({ status: 'TLE' }); await flush();
check('polling completes when WebSocket subscription fails', () => { assert.equal(offline.stats().finished, 1); assert.equal(offline.timers.size, 0); });
fs.mkdirSync('.runtime/judge-result-sync', { recursive: true });
fs.writeFileSync('.runtime/judge-result-sync/frontend-report.json', JSON.stringify({ passed: checks.length, checks, pollDelaysMs: jitter.delays }, null, 2));
console.log(`PASS ${checks.length} checks; .runtime/judge-result-sync/frontend-report.json`);
