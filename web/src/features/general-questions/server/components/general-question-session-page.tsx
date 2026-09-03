import "server-only";

import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { Container } from "@/components/layouts/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { routes } from "@/lib/routes";
import { generalQuestionLabel } from "../../shared/utils/general-question-labels";
import { getGeneralQuestionSessionBySlug } from "../loaders/get-general-question-sessions";

export async function GeneralQuestionSessionPage({ slug }: { slug: string }) {
  const session = await getGeneralQuestionSessionBySlug(slug);
  if (!session) notFound();
  return (
    <div className="min-h-dvh bg-mirai-surface-muted">
      <Container className="flex flex-col gap-8 pb-10 pt-24 md:pt-8">
        <header>
          <h1 className="text-3xl font-bold text-mirai-text">
            {session.name}の一般質問
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            集計単位: 1人の1登壇枠。対象期間: {session.startDate}〜
            {session.endDate}
          </p>
        </header>
        <p aria-live="polite" className="font-medium">
          {session.appearances.length}件の登壇枠
        </p>
        {session.appearances.length === 0 ? (
          <div className="rounded-xl border bg-card p-6">
            公開済みの一般質問データはありません。これは「実施なし」ではなく、未取得または未公開の可能性があります。
          </div>
        ) : (
          <ol className="space-y-5">
            {session.appearances.map((appearance) => (
              <li key={appearance.id} className="rounded-xl border bg-card p-5">
                <p className="text-sm font-medium text-primary-accent">
                  {appearance.heldOn ?? "開催日未確認"}・
                  {appearance.meetingStatus === "scheduled" ? "予定" : "実績"}
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {appearance.questionOrder
                    ? `${appearance.questionOrder}番目　`
                    : ""}
                  {appearance.speakerName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {generalQuestionLabel(appearance.questionKind)} /{" "}
                  {generalQuestionLabel(appearance.deliveryMethod)}
                </p>
                <section className="mt-5">
                  <h3 className="font-bold">質問項目</h3>
                  {appearance.items.length ? (
                    <ul className="mt-2 space-y-2">
                      {appearance.items.map((item) => (
                        <li
                          key={item.id}
                          className={
                            item.parentItemId
                              ? "ml-6 border-l pl-3"
                              : "font-medium"
                          }
                        >
                          {item.summary}
                          {item.topics.length ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {item.topics
                                .map((topic) => topic.label)
                                .join("、")}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      項目は未掲載です。
                    </p>
                  )}
                </section>
                <section className="mt-5">
                  <h3 className="font-bold">答弁者として掲載された役職</h3>
                  {appearance.answerers.length ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {appearance.answerers.map((answerer) => (
                        <li
                          key={answerer.id}
                          className="rounded-full border px-3 py-1 text-sm"
                        >
                          {answerer.roleName}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      答弁者は未掲載です。
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    個別項目への答弁帰属や答弁回数を示すものではありません。
                  </p>
                </section>
                {appearance.sourceUrl ? (
                  <p className="mt-5">
                    <a
                      href={appearance.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary-accent underline"
                    >
                      公式資料を確認する
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                    {appearance.sourceFetchedAt ? (
                      <span className="ml-3 text-xs text-muted-foreground">
                        取得日時: {appearance.sourceFetchedAt}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <Breadcrumb
          items={[
            { label: "トップ", href: routes.home() },
            { label: "一般質問", href: routes.generalQuestions() },
            { label: session.name },
          ]}
        />
      </Container>
    </div>
  );
}
