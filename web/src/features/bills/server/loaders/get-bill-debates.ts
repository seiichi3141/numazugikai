import "server-only";

import type { BillDebate } from "../../shared/types";
import { findBillDebatesByBillId } from "../repositories/bill-repository";

/** 議案詳細に表示する本会議の討論記録を取得する。 */
export async function getBillDebates(billId: string): Promise<BillDebate[]> {
  return findBillDebatesByBillId(billId);
}
