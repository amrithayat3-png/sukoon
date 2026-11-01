import { state } from './state.js';

const KEY_STORE = 'sukoon.key';
let memoryKey = null;

export const keyStore = {
  get() {
    try { return sessionStorage.getItem(KEY_STORE) || memoryKey; } catch { return memoryKey; }
  },
  set(key) {
    memoryKey = key;
    try { sessionStorage.setItem(KEY_STORE, key); } catch { /* storage may be blocked */ }
  },
  clear() {
    memoryKey = null;
    try { sessionStorage.removeItem(KEY_STORE); } catch { /* ignore */ }
  },
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body, keyOverride) {
  const headers = {};
  const key = keyOverride === undefined ? keyStore.get() : keyOverride;
  if (key) headers.authorization = `Bearer ${key}`;
  const init = { method, headers };
  // Only declare JSON when there is a body; the server rejects an empty JSON body.
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && keyOverride === undefined && !state.open) {
      keyStore.clear();
      location.hash = '#/login';
    }
    throw new ApiError(res.status, data?.error?.code || 'ERROR', data?.error?.message || 'Something went wrong.');
  }
  return data;
}

export const api = {
  meta: () => request('GET', '/api/v1/meta'),
  signup: (body) => request('POST', '/api/v1/accounts/signup', body, ''),
  login: (body) => request('POST', '/api/v1/accounts/login', body, ''),
  me: () => request('GET', '/api/v1/accounts/me'),
  adminOrgs: (adminKey) => request('GET', '/api/v1/admin/orgs', undefined, adminKey),
  adminCreate: (adminKey, body) => request('POST', '/api/v1/admin/orgs', body, adminKey),
  adminUpdate: (adminKey, id, body) => request('PUT', `/api/v1/admin/orgs/${id}`, body, adminKey),
  verify: (key) => request('POST', '/api/v1/auth/verify', undefined, key),
  tracks: () => request('GET', '/api/v1/tracks'),
  packs: (trackId) => request('GET', `/api/v1/tracks/${encodeURIComponent(trackId)}/packs`),
  pack: (packId) => request('GET', `/api/v1/packs/${encodeURIComponent(packId)}`),
  references: () => request('GET', '/api/v1/references'),
  createSession: (packId, alias) => request('POST', '/api/v1/sessions', alias ? { packId, alias } : { packId }),
  session: (id) => request('GET', `/api/v1/sessions/${id}`),
  save: (id, responses) => request('PUT', `/api/v1/sessions/${id}/responses`, { responses }),
  complete: (id) => request('POST', `/api/v1/sessions/${id}/complete`),
  results: (id) => request('GET', `/api/v1/sessions/${id}/results`),
  erase: (id) => request('DELETE', `/api/v1/sessions/${id}`),
  extras: (id, body) => request('PUT', `/api/v1/sessions/${id}/extras`, body),
  homework: () => request('GET', '/api/v1/homework'),
  help: () => request('GET', '/api/v1/help', undefined, ''),
  usage: () => request('GET', '/api/v1/usage'),
  feedback: (body) => request('POST', '/api/v1/feedback', body),
  changePassword: (body) => request('POST', '/api/v1/accounts/password', body),
  adminUsers: (adminKey, orgId) => request('GET', `/api/v1/admin/orgs/${orgId}/users`, undefined, adminKey),
  adminReset: (adminKey, userId) => request('POST', `/api/v1/admin/users/${userId}/reset-password`, undefined, adminKey),
  adminUsage: (adminKey) => request('GET', '/api/v1/admin/usage', undefined, adminKey),
  adminFeedback: (adminKey) => request('GET', '/api/v1/admin/feedback', undefined, adminKey),
};
