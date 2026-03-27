export function nowIso(): string {
  return new Date().toISOString();
}

export function toIso(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
