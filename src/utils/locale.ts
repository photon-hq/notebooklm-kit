/**
 * Locale resolution helpers for transport-layer language settings.
 */

import type { TransportLocaleSettings } from '../types/common.js';

interface ResolveLocaleOptions {
  requestedLocale?: string;
  env?: Record<string, string | undefined>;
}

function getEnvMap(env?: Record<string, string | undefined>): Record<string, string | undefined> {
  if (env) return env;
  // Safe access for Node.js environments.
  try {
    const proc = (globalThis as any).process;
    return (proc?.env as Record<string, string | undefined>) || {};
  } catch {
    return {};
  }
}

function cleanLocaleRaw(raw: string): string {
  // Handle values like ja_JP.UTF-8 or en_US@posix.
  return raw.split('.')[0].split('@')[0].trim();
}

function normalizeSubtags(locale: string): string | null {
  const cleaned = cleanLocaleRaw(locale).replace(/_/g, '-');
  if (!cleaned) return null;
  const parts = cleaned.split('-').filter(Boolean);
  if (parts.length === 0) return null;

  const language = parts[0].toLowerCase();
  if (!/^[a-z]{2,3}$/.test(language)) return null;

  const subtags: string[] = [language];
  for (let i = 1; i < parts.length; i += 1) {
    const p = parts[i];
    if (/^[a-zA-Z]{4}$/.test(p)) {
      subtags.push(`${p[0].toUpperCase()}${p.slice(1).toLowerCase()}`);
      continue;
    }
    if (/^[a-zA-Z]{2}$/.test(p) || /^[0-9]{3}$/.test(p)) {
      subtags.push(p.toUpperCase());
      continue;
    }
    if (/^[a-zA-Z0-9]{5,8}$/.test(p)) {
      subtags.push(p.toLowerCase());
      continue;
    }
  }

  return subtags.join('-');
}

export function normalizeLocaleTag(locale?: string): string | null {
  if (!locale) return null;
  return normalizeSubtags(locale);
}

function buildAcceptLanguage(locale: string): string {
  const [language, regionOrScript] = locale.split('-');
  if (!regionOrScript) {
    if (language === 'en') {
      return 'en-US,en;q=0.9';
    }
    return `${language},en-US;q=0.7,en;q=0.6`;
  }

  const regionCandidate = /^[A-Z0-9]{2,3}$/.test(regionOrScript) ? regionOrScript : '';
  const primary = regionCandidate ? `${language}-${regionCandidate}` : locale;

  if (language === 'en') {
    return `${primary},en;q=0.9`;
  }

  return `${primary},${language};q=0.9,en-US;q=0.6,en;q=0.5`;
}

export function resolveTransportLocaleSettings(
  options: ResolveLocaleOptions = {}
): TransportLocaleSettings {
  const env = getEnvMap(options.env);
  const requested = options.requestedLocale?.trim();

  let localeSource: TransportLocaleSettings['localeSource'] = 'default';
  let rawLocale = '';

  if (requested && requested.toLowerCase() !== 'auto') {
    rawLocale = requested;
    localeSource = 'config';
  } else if ((env.NOTEBOOKLM_LOCALE || '').trim()) {
    rawLocale = String(env.NOTEBOOKLM_LOCALE).trim();
    localeSource = 'env';
  } else {
    const systemLocale =
      (env.LC_ALL || '').trim() ||
      (env.LC_MESSAGES || '').trim() ||
      (env.LANG || '').trim();
    if (systemLocale) {
      rawLocale = systemLocale;
      localeSource = 'system';
    }
  }

  const normalized = normalizeLocaleTag(rawLocale) || 'en-US';
  if (!rawLocale) {
    localeSource = 'default';
  } else if (normalized === 'en-US' && localeSource !== 'default' && !normalizeLocaleTag(rawLocale)) {
    // Invalid locale fallback is treated as default behavior.
    localeSource = 'default';
  }

  const language = normalized.split('-')[0] || 'en';
  return {
    effectiveLocale: normalized,
    localeSource,
    hl: language.toLowerCase(),
    acceptLanguage: buildAcceptLanguage(normalized),
  };
}

export function normalizeHeaderKeys(headers?: Record<string, string>): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}
