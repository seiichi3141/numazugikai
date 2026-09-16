import type { AmivoiceSearchHit } from "../../parsers/parse-amivoice-search";

export type AmivoiceSessionHitGroup = {
  year: number;
  sessionNumber: number;
  kind: "regular" | "extraordinary";
  hits: AmivoiceSearchHit[];
};

export function groupAmivoiceSessionHits(
  hits: readonly AmivoiceSearchHit[]
): AmivoiceSessionHitGroup[] {
  const groups = new Map<string, AmivoiceSessionHitGroup>();
  for (const hit of hits) {
    const matched = hit.meetingName.match(/第\s*(\d+)\s*回(定例会|臨時会)/);
    if (!matched) continue;
    const year = Number(hit.date.slice(0, 4));
    const sessionNumber = Number(matched[1]);
    const kind = matched[2] === "臨時会" ? "extraordinary" : "regular";
    const key = `${year}:${sessionNumber}:${kind}`;
    const group = groups.get(key) ?? { year, sessionNumber, kind, hits: [] };
    group.hits.push(hit);
    groups.set(key, group);
  }
  return [...groups.values()];
}
