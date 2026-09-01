import Image from "next/image";
import { EXTERNAL_LINKS } from "@/config/external-links";
import { LinkButton } from "./link-button";

export function About() {
  return (
    <div className="py-10">
      <div className="flex flex-col gap-4">
        {/* ヘッダー */}
        <div className="flex flex-col gap-4">
          <h2>
            <Image
              src="/icons/about-typography.svg"
              alt="About"
              width={143}
              height={36}
              priority
            />
          </h2>
          <p className="text-sm font-bold text-primary-accent">
            みらい議会＠沼津市とは
          </p>
        </div>

        {/* コンテンツ */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="text-2xl font-bold leading-[43.2px]">
              沼津市議会の議論を
              <br />
              できる限りわかりやすく
            </h3>
            <p className="text-[15px] leading-[28px] text-black">
              みらい議会＠沼津市は、沼津市議会でいまどんな議案が審議されているかを、わかりやすく伝えるサービスです。市民の声が市政に届くことを目指して、継続的にアップデートしていきます。
            </p>
            <p className="text-[15px] leading-[28px] text-mirai-text-subtle">
              本サービスは有志が運営する非公式のサービスであり、沼津市および沼津市議会が運営するものではありません。議案の正式な内容や議会の日程は、沼津市議会の公式ページをご確認ください。
            </p>
          </div>

          {/* 沼津市議会の公式ページへ */}
          <LinkButton
            href={EXTERNAL_LINKS.NUMAZU_COUNCIL}
            icon={{
              src: "/icons/info-icon.svg",
              alt: "",
              width: 23,
              height: 22,
            }}
          >
            沼津市議会の公式ページ
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
