import type { ComingSoonBill } from "../types";

export async function loadComingSoonBillsWhenEnabled(options: {
  enabled: boolean;
  load: () => Promise<ComingSoonBill[]>;
}): Promise<ComingSoonBill[] | null> {
  if (!options.enabled) return null;
  return options.load();
}
