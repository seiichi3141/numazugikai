import "server-only";
import { findPublishedBillSitemapEntries } from "../repositories/bill-repository";

export async function getPublishedBillSitemapEntries() {
  return findPublishedBillSitemapEntries();
}
