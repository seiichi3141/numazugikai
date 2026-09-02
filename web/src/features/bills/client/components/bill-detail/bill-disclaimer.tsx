import { LinkButton } from "@/components/top/link-button";
import { EXTERNAL_LINKS } from "@/config/external-links";

export function BillDisclaimer() {
  return (
    <div className="space-y-6 pt-4 pb-10">
      {/* 公式サービスとの混同を避けるため、出典より先に運営主体を示す */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">
          本サービスについて
        </h3>
        <p className="text-xs leading-relaxed text-mirai-text-note">
          本サービスは有志が運営する非公式のサービスです。沼津市および沼津市議会の公式サービスではなく、両者が内容を監修・保証するものではありません。また、政党チームみらいが運営しているものでもありません。
        </p>
      </div>

      {/* データの出典について */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">
          掲載コンテンツについて
        </h3>
        <p className="text-xs leading-relaxed text-mirai-text-note">
          掲載されている議案情報は、沼津市議会が公開する議案審議結果・会議記録などの公開情報を基に、AIを活用しながら背景情報を整理したものです。掲載議案は主に、市長が提出した議案を対象としております。
        </p>
      </div>

      {/* 掲載コンテンツについての免責事項 */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">免責事項</h3>
        <p className="text-xs leading-relaxed text-mirai-text-note">
          本サイトで公開する情報は、可能な限り正確かつ最新の情報を反映するよう努めていますが、その正確性・完全性・即時性について保証するものではありません。また、AIチャットは不正確または誤解を招く回答を生成する可能性があります。正確な情報は、沼津市議会が公開する議案書・会議録などの一次資料をご確認ください。
        </p>
      </div>

      <LinkButton
        href={EXTERNAL_LINKS.NUMAZU_COUNCIL}
        icon={{
          src: "/icons/question-bubble.svg",
          alt: "",
          width: 22,
          height: 22,
        }}
      >
        沼津市議会の公式ページ
      </LinkButton>
    </div>
  );
}
