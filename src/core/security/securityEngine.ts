/**
 * TerraMaps Core Engine - Security & Hardening Module
 * 
 * Provides centralized input validation, payload size enforcement, prototype pollution protection,
 * XSS sanitization, safe storage key verification, and geospatial coordinate bounds checking.
 */

// Strict resolution 9 H3 index regex (15 hexadecimal characters)
const H3_INDEX_REGEX = /^[0-9a-fA-F]{15}$/;

// Disallowed storage keys that could trigger prototype pollution
const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Allowed username character whitelist (alphanumeric, spaces, underscores, hyphens, latin accents)
const USERNAME_ALLOWED_REGEX = /[^a-zA-Z0-9_\-\s\u00C0-\u017F]/g;

// Safe email pattern RFC 5322 compatible subset
const SAFE_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates whether an identifier is a well-formed 15-character H3 hexadecimal string.
 * Prevents injection, corrupted memory, or malformed index processing.
 */
export function validateH3Index(hexId: unknown): boolean {
  if (typeof hexId !== 'string') return false;
  return H3_INDEX_REGEX.test(hexId.trim());
}

/**
 * Strips HTML tags, null bytes, and non-printable control characters.
 * Enforces maximum character length to prevent DoS.
 */
export function sanitizeString(input: unknown, maxLength: number = 255): string {
  if (input === null || input === undefined) return '';
  const str = String(input);

  // Normalize Unicode to canonical form
  const normalized = str.normalize('NFKC');

  // Strip null bytes and control chars (except standard space)
  const noControl = normalized.replace(/[\x00-\x1F\x7F]/g, '');

  // Strip HTML tags to prevent XSS
  const noHtml = noControl.replace(/<[^>]*>?/gm, '');

  // Trim and enforce maximum length
  return noHtml.trim().slice(0, maxLength);
}

/**
 * Sanitizes and validates a user or explorer username.
 * Guarantees length between 3 and 30 characters and disallows unsafe scripting symbols.
 */
export function sanitizeUsername(username: unknown, fallback: string = 'Explorador'): string {
  const sanitized = sanitizeString(username, 30)
    .replace(USERNAME_ALLOWED_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitized.length < 3) {
    return fallback;
  }
  return sanitized;
}

/**
 * Validates that a storage key is safe and does not trigger prototype pollution or path traversal.
 */
export function validateSafeStorageKey(key: unknown): boolean {
  if (typeof key !== 'string' || key.length === 0 || key.length > 128) {
    return false;
  }
  const trimmed = key.trim();
  if (DANGEROUS_OBJECT_KEYS.has(trimmed)) {
    return false;
  }
  // Disallow directory traversal sequences
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    return false;
  }
  // Safe alphanumeric with standard namespace characters (@, _, -, .)
  return /^[@a-zA-Z0-9_\-\.]+$/.test(trimmed);
}

/**
 * Safe JSON parser with strict payload size limits and prototype pollution defense.
 */
export function safeJsonParse<T>(
  raw: unknown,
  fallback: T,
  maxSizeBytes: number = 10 * 1024 * 1024 // 10MB default limit
): T {
  if (typeof raw !== 'string') {
    return fallback;
  }

  // Reject oversized strings before parsing to prevent memory exhaustion DoS
  if (raw.length > maxSizeBytes) {
    console.warn(`[Security] JSON payload rejected: size ${raw.length} exceeds limit of ${maxSizeBytes} bytes.`);
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw, (key, value) => {
      // Prototype pollution defense
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * Validates that geographic coordinates are finite numbers within Earth's WGS84 boundary.
 */
export function validateCoordinates(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Validates an avatar URL to prevent javascript: or data:text/html XSS vectors.
 */
export function validateSafeUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return false;

  // Allow secure https, http, and safe base64 images
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Validates email format before authentication operations.
 */
export function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return SAFE_EMAIL_REGEX.test(trimmed);
}
