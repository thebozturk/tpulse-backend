/**
 * "field" (asc) veya "-field" (desc) formatındaki sort query'sini ayrıştırır.
 * Whitelist dışı alan → null (caller default orderBy uygular).
 * Repo'larda tekrarlanan orderBy parse mantığını tek yerde toplar.
 */
export function parseSort(
  sort: string | undefined,
  allowed: ReadonlySet<string>,
): { field: string; direction: 'asc' | 'desc' } | null {
  if (!sort) {
    return null;
  }
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  if (!allowed.has(field)) {
    return null;
  }
  return { field, direction: desc ? 'desc' : 'asc' };
}
