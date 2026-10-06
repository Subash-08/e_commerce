export class DomainError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "DomainError";
  }
}
export function requireFact(
  condition: unknown,
  code: string,
): asserts condition {
  if (!condition) throw new DomainError(code);
}
export function identifier(value: string): string {
  requireFact(
    typeof value === "string" && value.trim().length > 0 && value.length <= 200,
    "INVALID_IDENTIFIER",
  );
  return value;
}
export function integer(
  value: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  requireFact(
    Number.isSafeInteger(value) && value >= min && value <= max,
    "INVALID_INTEGER",
  );
  return value;
}
