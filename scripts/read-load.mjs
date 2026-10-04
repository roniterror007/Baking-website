/** Reproducible read benchmark. Safe default targets only the local preview. */
import { performance } from 'node:perf_hooks';
const origin = process.env.LOAD_TEST_URL || 'http://127.0.0.1:5173';
const url = new URL('/api/catalog', origin);
if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) && process.env.ALLOW_HOSTED_LOAD !== '1') {
  throw new Error('Hosted benchmarks require explicit ALLOW_HOSTED_LOAD=1.');
}
const requests = Math.max(1, Math.min(Number(process.env.LOAD_REQUESTS) || 1000, 10000));
const concurrency = Math.max(1, Math.min(Number(process.env.LOAD_CONCURRENCY) || 25, 100));
const headers = process.env.SITES_SERVICE_TOKEN ? { 'OAI-Sites-Authorization': `Bearer ${process.env.SITES_SERVICE_TOKEN}` } : {};
let issued = 0, successes = 0, failures = 0;
const durations = [], start = performance.now();
const warm = await fetch(url, { headers });
if (!warm.ok) throw new Error(`Warmup failed with ${warm.status}`);
await warm.arrayBuffer();
await Promise.all(Array.from({length:concurrency}, async () => {
  while (issued < requests) {
    issued++; const began = performance.now();
    try {
      const response = await fetch(url, {headers,signal:AbortSignal.timeout(30000)});
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.products) || !data.products.length) throw new Error('Invalid catalog');
      successes++;
    } catch { failures++; }
    durations.push(performance.now() - began);
  }
}));
durations.sort((a,b) => a-b);
const elapsedMs = performance.now() - start;
console.log(JSON.stringify({target:url.origin,requests,concurrency,successes,failures,elapsedMs:Math.round(elapsedMs),requestsPerSecond:Number((requests/elapsedMs*1000).toFixed(1)),p50Ms:Math.round(durations[Math.floor(durations.length*.5)]),p95Ms:Math.round(durations[Math.floor(durations.length*.95)]),note:'Catalog reads only. This does not certify 1000 concurrent users or checkout throughput.'},null,2));
if (failures) process.exitCode = 1;
