import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const origin = 'http://127.0.0.1:5180/';
const dist = resolve('dist');
const events = new Map();
const stores = new Map();

function keyOf(request, ignoreSearch = false) {
  const url = new URL(typeof request === 'string' ? request : request.url, origin);
  if (ignoreSearch) url.search = '';
  return url.href;
}

const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async addAll(paths) {
        for (const path of paths) {
          const file = resolve(dist, path === './' ? 'index.html' : path.replace(/^\.\//, ''));
          assert.ok(existsSync(file), `Arquivo não encontrado no precache: ${path}`);
          entries.set(keyOf(path), { ok: true, path });
        }
      },
      async put(request, response) { entries.set(keyOf(request), response); }
    };
  },
  async match(request, options = {}) {
    const requested = keyOf(request, options.ignoreSearch);
    for (const entries of stores.values()) {
      for (const [key, response] of entries) {
        if (keyOf(key, options.ignoreSearch) === requested) return response;
      }
    }
  },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); }
};

const self = {
  location: { origin: new URL(origin).origin },
  clients: { async claim() {} },
  async skipWaiting() {},
  addEventListener(type, callback) { events.set(type, callback); }
};

let fetchImpl = async () => { throw new Error('Sem conexão'); };

vm.runInNewContext(readFileSync(resolve(dist, 'sw.js'), 'utf8'), {
  self, caches, URL,
  fetch: (...args) => fetchImpl(...args),
  Response: { error: () => ({ ok: false }) }
});

stores.set('aroldo-barber-antigo', new Map());
let pending;
events.get('install')({ waitUntil(promise) { pending = promise; } });
await pending;
assert.ok([...stores.keys()].some(name => name.startsWith('aroldo-barber-v')));

events.get('activate')({ waitUntil(promise) { pending = promise; } });
await pending;
assert.ok(!stores.has('aroldo-barber-antigo'));

let responsePromise;
events.get('fetch')({
  request: { method: 'GET', mode: 'navigate', url: `${origin}?offline=1` },
  respondWith(promise) { responsePromise = promise; }
});
assert.equal((await responsePromise).path, './index.html');

events.get('fetch')({
  request: { method: 'GET', mode: 'same-origin', url: `${origin}styles.css` },
  respondWith(promise) { responsePromise = promise; }
});
assert.equal((await responsePromise).path, './styles.css');

fetchImpl = async () => ({ ok: true, path: './styles.css@atualizado', clone() { return this; } });
events.get('fetch')({
  request: { method: 'GET', mode: 'same-origin', url: `${origin}styles.css` },
  respondWith(promise) { responsePromise = promise; }
});
assert.equal((await responsePromise).path, './styles.css@atualizado');

fetchImpl = async () => { throw new Error('Sem conexão'); };
events.get('fetch')({
  request: { method: 'GET', mode: 'same-origin', url: `${origin}styles.css` },
  respondWith(promise) { responsePromise = promise; }
});
assert.equal((await responsePromise).path, './styles.css@atualizado');

console.log('PWA smoke: precache, atualização de recurso e navegação offline OK');
