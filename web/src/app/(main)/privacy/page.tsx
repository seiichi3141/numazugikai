import type { Metadata, Route } from "next";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import {
  LegalList,
  LegalPageLayout,
  LegalParagraph,
  LegalSectionTitle,
} from "@/components/layouts/legal-page-layout";
import { EXTERNAL_LINKS } from "@/config/external-links";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "プライバシーポリシー | みらい議会＠沼津市",
  description: "みらい議会＠沼津市のプライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      className="bg-transparent pt-24 md:pt-12"
      title="プライバシーポリシー"
      enLabel="Privacy Policy"
      description="みらい議会＠沼津市（以下「本サービス」といいます）の運営者（以下「当運営者」といいます）における個人情報の取り扱いについてご説明します。"
    >
      <Container className="space-y-8">
        <p className="text-sm text-mirai-text-muted">
          最終更新日：2026年9月1日
        </p>

        <section className="space-y-4">
          <LegalSectionTitle>1. 個人情報の定義</LegalSectionTitle>
          <LegalParagraph>
            個人情報とは、以下のような情報であって、特定の個人を識別することができるものを指します。
          </LegalParagraph>
          <LegalList
            items={[
              "氏名、年齢、性別、住所、電話番号、職業、メールアドレス",
              "個人ごとに割り当てられたIDやパスワード、その他識別可能な記号",
              "本サービスのAIインタビュー機能（以下「AIインタビュー機能」といいます。）を通じて取得される対話ログ、音声データ、および行動履歴",
              "他の情報と容易に照合することができ、それにより特定の個人を識別できることとなるもの",
            ]}
          />
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>2. 個人情報の収集方法と使用範囲</LegalSectionTitle>
          <LegalParagraph>
            個人情報をご提供いただく際には、ユーザーの同意に基づいて行うことを原則とします。また、当運営者は、以下に定める目的での利用を除き、個人情報を無断で利用することはありません。
          </LegalParagraph>
          <LegalList
            items={[
              "本サービスの運営およびそれに伴うユーザーとのやりとり・情報提供",
              "本サービスの安全な運営に必要な不正対策",
              "本サービスの改善・新規開発",
              "本サービスに係る情報提供",
              "上記の各利用目的に必要な各種調査・分析",
              "「3. 第三者への情報提供について」に定める場合における第三者への開示・提供",
            ]}
          />
          <LegalParagraph>
            なお、AIインタビュー機能を通じて当運営者が取得した回答内容については、当運営者は、以下の通り取り扱います。
          </LegalParagraph>
          <LegalList
            items={[
              {
                id: "publish",
                content: (
                  <>
                    <span className="font-semibold text-mirai-text-secondary">
                      公開：
                    </span>
                    ユーザーが回答時に公開に同意した場合に限り、本サービスや報告書等で公開されることがあります。本人が公開に同意しなかった回答内容は、第三者に公開または提供されることはありません。
                  </>
                ),
              },
              {
                id: "open-data",
                content: (
                  <>
                    <span className="font-semibold text-mirai-text-secondary">
                      第三者への提供（オープンデータ公開）：
                    </span>
                    インタビューデータを、別途定める「
                    <Link
                      href={routes.interviewDataTerms()}
                      className="text-primary-accent underline"
                    >
                      みらい議会＠沼津市 AIインタビューデータ利用規約
                    </Link>
                    」に同意する者であれば誰でもダウンロード可能なオープンデータとして第三者に提供することがあります。
                  </>
                ),
              },
              {
                id: "statistics",
                content: (
                  <>
                    <span className="font-semibold text-mirai-text-secondary">
                      統計的利用：
                    </span>
                    取得したデータは、個人を特定できない統計情報に加工した上で、第三者へ公表する場合があります。
                  </>
                ),
              },
            ]}
          />
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>3. 第三者への情報提供について</LegalSectionTitle>
          <LegalParagraph>
            以下のいずれかに該当する場合を除き、個人情報を第三者に開示・提供することはありません。
          </LegalParagraph>
          <LegalList
            items={[
              "「2. 個人情報の収集方法と使用範囲」に定めるAIインタビュー機能を通じて当運営者が取得した回答内容を、本人が公開に同意した範囲で公開する場合、および別途定める「みらい議会＠沼津市 AIインタビューデータ利用規約」に同意する者であれば誰でもダウンロード可能なオープンデータとして第三者に提供する場合",
              "ユーザー本人の同意がある場合",
              "統計的なデータなど、個人を特定できない状態で提供する場合",
              "法令に基づく開示請求（裁判所・警察等）があった場合",
              "不正アクセスや規約違反など、緊急の対応が必要と判断された場合",
            ]}
          />
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>4. 安全管理措置</LegalSectionTitle>
          <LegalParagraph>
            個人情報の適切な管理を行うために、責任者を定め、厳正な管理体制を構築しています。AI処理に伴うデータ保管についても、最新のセキュリティ対策を講じます。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>5. Cookie（クッキー）について</LegalSectionTitle>
          <LegalParagraph>
            本サービスでは、利便性向上とアクセス解析（Googleアナリティクス等）のためにCookieを使用しています。これらは匿名で収集され、個人を特定するものではありません。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>6. 保管期間と廃棄</LegalSectionTitle>
          <LegalParagraph>
            取得した個人情報および対話ログは、利用目的の達成に必要な期間および法令上保管が求められる期間が経過した後、適切な方法で廃棄・削除します。なお、本人の同意に基づき公開された回答内容、および個人を特定できないよう加工した上でオープンデータとして提供されたデータなど当運営者が管理していない情報は、廃棄・削除を行うことはできないため、継続して公開・提供されることがあります。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>7. 改訂と通知</LegalSectionTitle>
          <LegalParagraph>
            本ポリシーは必要に応じて改訂されます。改訂内容は本サービスへの掲載をもって効力を生じるものとし、個別の通知は行いません。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>8. お問い合わせ窓口</LegalSectionTitle>
          <LegalParagraph>
            個人情報の確認・修正・削除、またはAIインタビュー機能の回答公開の停止等のご相談は、本サービスのGitHubリポジトリのIssueよりご連絡ください。
          </LegalParagraph>
          <LegalParagraph>
            <Link
              href={EXTERNAL_LINKS.GITHUB_REPO as Route}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-accent underline"
            >
              {EXTERNAL_LINKS.GITHUB_REPO}
            </Link>
          </LegalParagraph>
        </section>
      </Container>
    </LegalPageLayout>
  );
}
