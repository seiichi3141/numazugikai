type QuestionItemOrder = {
  id: string;
  parentItemId: string | null;
  order: number | null;
};

/** 親を先に、同じ親の項目は資料上の順番で並べる。 */
export function sortQuestionItems<T extends QuestionItemOrder>(
  items: readonly T[]
): T[] {
  const byParent = new Map<string | null, T[]>();
  const ids = new Set(items.map((item) => item.id));
  for (const item of items) {
    const parent = item.parentItemId;
    const key = parent !== null && ids.has(parent) ? parent : null;
    const siblings = byParent.get(key) ?? [];
    siblings.push(item);
    byParent.set(key, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)
    );
  }

  const result: T[] = [];
  const visited = new Set<string>();
  const append = (item: T) => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    result.push(item);
    for (const child of byParent.get(item.id) ?? []) append(child);
  };
  for (const root of byParent.get(null) ?? []) append(root);
  for (const item of items) append(item);
  return result;
}
