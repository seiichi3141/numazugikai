import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { findPublishedBillSitemapEntries } from "../repositories/bill-repository";

const getCachedPublishedBillSitemapEntries = unstable_cache(
  findPublishedBillSitemapEntries,
  ["published-bill-sitemap-entries"],
  { revalidate: 600, tags: [CACHE_TAGS.BILLS] }
);

export async function getPublishedBillSitemapEntries() {
  return getCachedPublishedBillSitemapEntries();
}
