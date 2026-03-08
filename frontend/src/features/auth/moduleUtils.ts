const ACCENT_REGEX = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC_REGEX = /[^\p{L}\p{N}]+/gu;
const LEADING_HYPHENS_REGEX = /^-+|-+$/g;

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(ACCENT_REGEX, "")
    .replace(NON_ALPHANUMERIC_REGEX, "-")
    .replace(LEADING_HYPHENS_REGEX, "")
    .toLowerCase();

export const normalizeModuleId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = normalize(trimmed);
  return normalized || null;
};

export const sanitizeModuleList = (value: unknown): string[] => {
  let items: unknown[];

  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          items = parsed;
        } else {
          return [];
        }
      } catch {
        return [];
      }
    } else if (trimmed.startsWith("{")) {
      // Handle PostgreSQL text[] format: '{"a","b","c"}'
      items = parsePostgresTextArray(trimmed);
    } else {
      return [];
    }
  } else {
    return [];
  }

  const unique = new Set<string>();

  for (const entry of items) {
    const moduleId = normalizeModuleId(entry);
    if (!moduleId || unique.has(moduleId)) {
      continue;
    }

    unique.add(moduleId);
  }

  return [...unique];
};

/**
 * Parseia uma string no formato PostgreSQL text[] (ex: '{"a","b","c"}')
 * para um array JavaScript.
 */
const parsePostgresTextArray = (value: string): string[] => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "{}") return [];

  const inner = trimmed.replace(/^\{/, "").replace(/\}$/, "");
  if (!inner) return [];

  const result: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (char === '"') {
      if (inQuote && inner[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === "," && !inQuote) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) {
    result.push(current);
  }

  return result;
};

export const createNormalizedModuleSet = (modules: Iterable<string>): Set<string> => {
  const normalized = new Set<string>();

  for (const moduleId of modules) {
    const normalizedId = normalizeModuleId(moduleId);
    if (!normalizedId) {
      continue;
    }

    normalized.add(normalizedId);
  }

  return normalized;
};

