import {
  Ban,
  CheckCircle,
  Clock,
  FileText,
  Megaphone,
  PauseCircle,
  Settings,
  ThumbsUp,
  Undo2,
  XCircle,
} from "lucide-react";
import type { ElementType } from "react";

import type { BillStatus } from "../types";

// ステータスの表示設定（一覧画面で使用）
export const BILL_STATUS_CONFIG: Record<
  BillStatus,
  { icon: ElementType; color: string }
> = {
  preparing: {
    icon: Settings,
    color: "text-gray-600 bg-gray-50",
  },
  submitted: {
    icon: FileText,
    color: "text-blue-600 bg-blue-50",
  },
  in_committee: {
    icon: Clock,
    color: "text-yellow-600 bg-yellow-50",
  },
  passed: {
    icon: CheckCircle,
    color: "text-green-600 bg-green-50",
  },
  rejected: {
    icon: XCircle,
    color: "text-red-600 bg-red-50",
  },
  consented: {
    icon: ThumbsUp,
    color: "text-green-600 bg-green-50",
  },
  approved: {
    icon: CheckCircle,
    color: "text-green-600 bg-green-50",
  },
  certified: {
    icon: CheckCircle,
    color: "text-green-600 bg-green-50",
  },
  adopted: {
    icon: ThumbsUp,
    color: "text-green-600 bg-green-50",
  },
  not_adopted: {
    icon: Ban,
    color: "text-red-600 bg-red-50",
  },
  continued: {
    icon: PauseCircle,
    color: "text-orange-600 bg-orange-50",
  },
  withdrawn: {
    icon: Undo2,
    color: "text-gray-600 bg-gray-50",
  },
  reported: {
    icon: Megaphone,
    color: "text-slate-600 bg-slate-50",
  },
};
