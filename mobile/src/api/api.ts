const API_BASE = 'http://192.168.8.117:8000';

let authToken = '';

export function setAuthToken(token: string) {
  authToken = token;
}

async function apiFetch(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const LANG = 'ru';

export async function sendOtp(email: string, lang: string = 'en'): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, lang }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function verifyOtp(email: string, code: string): Promise<{ token: string; is_new_user: boolean }> {
  const res = await fetch(`${API_BASE}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function logoutApi(token: string): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  language: string;
}

export async function getMe(): Promise<UserProfile> {
  return apiFetch('/api/v1/users/me');
}

export async function setName(token: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export interface Expression {
  phrase: string;
  literal: string;
  explanation: string;
}

export interface Word {
  word: string;
  level: string;
  translation: string;
}

export interface ReelCard {
  id: string;
  rand: number;
  quote_en: string;
  context: string;
  quote_translated: string;
  show: string;
  season: number | null;
  episode: number | null;
  speaker: string | null;
  expressions: Expression[];
  words: Word[];
  saved: boolean;
  liked: boolean;
}

export interface FeedResponse {
  items: ReelCard[];
  next_cursor: number;
  has_more: boolean;
}

export async function getFeed(params: {
  resume?: boolean;
  limit?: number;
}): Promise<FeedResponse> {
  const p = new URLSearchParams({ limit: String(params.limit ?? 15), lang: LANG });
  if (params.resume) p.set('resume', 'true');
  return apiFetch(`/api/v1/feed?${p}`);
}

export async function getFeedState(): Promise<{ cursor: number | null }> {
  return apiFetch('/api/v1/feed/state');
}

export async function savePosition(prevRand: number): Promise<void> {
  await apiFetch(`/api/v1/feed/position?prev_rand=${prevRand}`, { method: 'POST' });
}

export async function toggleLike(cardId: string): Promise<{ liked: boolean }> {
  return apiFetch(`/api/v1/likes/${cardId}`, { method: 'POST' });
}

export async function toggleSave(cardId: string): Promise<{ saved: boolean }> {
  return apiFetch(`/api/v1/saves/${cardId}`, { method: 'POST' });
}

export async function getSavesCount(): Promise<{ count: number }> {
  return apiFetch('/api/v1/saves/count');
}

export interface SavesCardsResponse {
  items: ReelCard[];
  total: number;
}

export async function getSavedCards(params: {
  lang?: string;
  limit?: number;
  skip?: number;
}): Promise<SavesCardsResponse> {
  const p = new URLSearchParams({
    lang: params.lang ?? LANG,
    limit: String(params.limit ?? 15),
    skip: String(params.skip ?? 0),
  });
  return apiFetch(`/api/v1/saves/cards?${p}`);
}

export async function getUserLevels(): Promise<{ levels: string[] }> {
  return apiFetch('/api/v1/users/me/levels');
}

export async function updateUserLevels(levels: string[]): Promise<{ levels: string[] }> {
  return apiFetch('/api/v1/users/me/levels', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ levels }),
  });
}

export async function postEvent(
  cardId: string,
  event: 'flip' | 'skip' | 'dislike',
): Promise<void> {
  await apiFetch('/api/v1/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: cardId, event }),
  });
}

export interface SubdomainItem {
  name: string;
  full_name: string;
  count: number;
}

export interface DomainItem {
  name: string;
  subdomains: SubdomainItem[];
}

export async function getCatalogDomains(): Promise<{ domains: DomainItem[] }> {
  const res = await fetch(`${API_BASE}/api/v1/catalog/domains`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getUserDomains(): Promise<{ domains: string[] }> {
  return apiFetch('/api/v1/users/me/domains');
}

export async function updateUserDomains(domains: string[]): Promise<{ domains: string[] }> {
  return apiFetch('/api/v1/users/me/domains', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domains }),
  });
}
