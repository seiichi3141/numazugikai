type EvidenceRole = "primary" | "supplementary";

export function prioritizePrimaryEvidence<
  T extends { id: string; role: EvidenceRole },
>(evidence: T[]): T[] {
  return [...evidence].sort(
    (a, b) =>
      Number(a.role !== "primary") - Number(b.role !== "primary") ||
      a.id.localeCompare(b.id)
  );
}
