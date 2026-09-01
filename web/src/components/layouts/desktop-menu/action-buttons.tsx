import { LinkButton } from "@/components/top/link-button";
import { EXTERNAL_LINKS } from "@/config/external-links";

/**
 * デスクトップメニュー: アクションボタン（サイドバー内）
 */
export function DesktopMenuActionButtons() {
  return (
    <div className="flex flex-col gap-3">
      <LinkButton
        href={EXTERNAL_LINKS.NUMAZU_COUNCIL}
        icon={{
          src: "/icons/info-icon.svg",
          alt: "",
          width: 20,
          height: 20,
        }}
      >
        沼津市議会の公式ページ
      </LinkButton>
    </div>
  );
}
