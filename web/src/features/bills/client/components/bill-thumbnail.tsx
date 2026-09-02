import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  type BillThumbnailSource,
  resolveBillThumbnail,
} from "../../shared/utils/bill-thumbnail";

interface BillThumbnailProps {
  bill: BillThumbnailSource;
  /** 枠の大きさや角丸。relative と overflow-hidden は内側で付ける。 */
  className?: string;
  /** 表示幅。fill 画像は無指定だと 100vw 扱いで無駄に大きい変換を取るため必須。 */
  sizes: string;
  priority?: boolean;
}

/**
 * 議案のサムネイル。画像が無い議案には分野タグのイラストを出す。
 * 常に見出しの隣に置かれる飾りなので alt は空にし、タイトルを二度読ませない。
 */
export function BillThumbnail({
  bill,
  className,
  sizes,
  priority,
}: BillThumbnailProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={resolveBillThumbnail(bill)}
        alt=""
        fill
        className="object-cover"
        sizes={sizes}
        priority={priority}
      />
    </div>
  );
}
