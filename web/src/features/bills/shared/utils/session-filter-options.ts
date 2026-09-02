import { FACET_ALL } from "./bills-list-facets";

export type SessionFilterOption = {
  /** URL に載せる値。「すべて」は空文字。 */
  value: string;
  label: string;
  count: number;
};

/**
 * 「会期」セレクトの選択肢を作る純粋関数。定例会と臨時会の両方が並ぶ。
 *
 * 0件の会期は落とす。選んでも何も出ない選択肢を並べる意味がない。
 * ただし選択中の会期は0件でも残す。消すと何で絞られているのか分からなくなる。
 */
export function toSessionFilterOptions(
  sessions: readonly { id: string; slug: string; name: string }[],
  counts: ReadonlyMap<string, number>,
  selectedSlug: string | null
): SessionFilterOption[] {
  const all = {
    value: "",
    label: "すべての会期",
    count: counts.get(FACET_ALL) ?? 0,
  };
  const options = sessions
    .map((session) => ({
      value: session.slug,
      label: session.name,
      count: counts.get(session.id) ?? 0,
    }))
    .filter((option) => option.count > 0 || option.value === selectedSlug);
  return [all, ...options];
}
