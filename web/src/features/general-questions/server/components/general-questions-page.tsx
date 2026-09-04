import "server-only";

import { generalQuestionLabel } from "@mirai-gikai/shared/general-questions/labels";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { formatDateTime } from "@/lib/utils/date";
import { buildGeneralQuestionVisualization } from "../../shared/utils/build-general-question-visualization";
import { getGeneralQuestionSessions } from "../loaders/get-general-question-sessions";

type Filters = {
  session?: string;
  year?: string;
  questionKind?: string;
  topic?: string;
  role?: string;
};

const questionKindLabels: Record<string, string> = {
  representative: "代表質問",
  personal: "個人質問",
  other: "その他",
  unknown: "種別未確認",
};

export async function GeneralQuestionsPage({ filters }: { filters: Filters }) {
  const sessions = await getGeneralQuestionSessions();
  const selectedSessions = filters.session
    ? sessions.filter((session) => session.slug === filters.session)
    : sessions;
  const hasAppearanceFilter = Boolean(
    filters.year || filters.questionKind || filters.topic || filters.role
  );
  const shown = selectedSessions
    .map((session) => ({
      ...session,
      appearances: session.appearances.filter(
        (appearance) =>
          (!filters.year ||
            appearance.heldOn?.startsWith(`${filters.year}-`)) &&
          (!filters.questionKind ||
            appearance.questionKind === filters.questionKind) &&
          (!filters.topic ||
            appearance.items.some((item) =>
              item.topics.some((topic) => topic.slug === filters.topic)
            )) &&
          (!filters.role ||
            appearance.answerers.some(
              (answerer) => answerer.roleGroup === filters.role
            ))
      ),
    }))
    .filter(
      (session) => !hasAppearanceFilter || session.appearances.length > 0
    );
  const appearanceCount = shown.reduce(
    (total, session) => total + session.appearances.length,
    0
  );
  const visualization = buildGeneralQuestionVisualization(shown);
  const continuingTopics = visualization.topics.filter(
    (topic) => topic.sessionNames.length > 1
  );
  const taxonomyVersion = shown.find((session) => session.classificationRelease)
    ?.classificationRelease?.taxonomyVersion;
  const coverageEntries = shown.flatMap((session) => {
    const sessionCoverage = session.coverage.length ? session.coverage : [null];
    return sessionCoverage.map((coverage, index) => ({
      key: `${session.id}-${coverage?.sourceKind ?? "none"}`,
      sessionName: session.name,
      coverage,
      showSessionName: index === 0,
      sessionRowSpan: sessionCoverage.length,
    }));
  });
  const topicOptions = new Map<string, string>();
  const roleOptions = new Set<string>();
  const yearOptions = new Set<string>();
  for (const session of sessions) {
    for (const appearance of session.appearances) {
      if (appearance.heldOn) yearOptions.add(appearance.heldOn.slice(0, 4));
      for (const item of appearance.items) {
        for (const topic of item.topics)
          topicOptions.set(topic.slug, topic.label);
      }
      for (const answerer of appearance.answerers) {
        if (answerer.roleGroup !== "unknown")
          roleOptions.add(answerer.roleGroup);
      }
    }
  }

  return (
    <div className="min-h-dvh bg-mirai-surface-muted">
      <Container className="flex flex-col gap-8 pb-10 pt-24 md:pt-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-mirai-text">一般質問</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            沼津市議会の一般質問を、開催日と質問項目から確認できます。本サービスは非公式であり、正式な内容は各公式資料をご確認ください。
          </p>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            質問項目の表示文は公式資料を基に生成AIで要約し、人手で原資料との照合・確認を行っています。
          </p>
        </header>

        <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm font-medium">
            <span>会期</span>
            <select
              name="session"
              defaultValue={filters.session ?? ""}
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="">すべての会期</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.slug}>
                  {session.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>開催年（西暦）</span>
            <select
              name="year"
              defaultValue={filters.year ?? ""}
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="">すべての年度</option>
              {[...yearOptions]
                .sort((a, b) => b.localeCompare(a))
                .map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>政策分野</span>
            <select
              name="topic"
              defaultValue={filters.topic ?? ""}
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="">すべての政策分野</option>
              {[...topicOptions].map(([slug, label]) => (
                <option key={slug} value={slug}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>答弁者役職</span>
            <select
              name="role"
              defaultValue={filters.role ?? ""}
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="">すべての役職</option>
              {[...roleOptions].map((role) => (
                <option key={role} value={role}>
                  {generalQuestionLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>質問種別</span>
            <select
              name="questionKind"
              defaultValue={filters.questionKind ?? ""}
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="">すべての種別</option>
              <option value="representative">代表質問</option>
              <option value="personal">個人質問</option>
              <option value="other">その他</option>
              <option value="unknown">種別未確認</option>
            </select>
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <Button type="submit">絞り込む</Button>
            <Button asChild variant="outline">
              <Link href={routes.generalQuestions()}>解除</Link>
            </Button>
          </div>
        </form>

        <p aria-live="polite" className="font-medium">
          {appearanceCount}件の登壇枠
        </p>

        <section aria-labelledby="timeline-heading" className="space-y-4">
          <div>
            <h2
              id="timeline-heading"
              className="text-2xl font-bold text-mirai-text"
            >
              会期タイムライン
            </h2>
            <p className="text-sm text-muted-foreground">
              件数順ではなく、会期と開催日の新しい順に表示します。
            </p>
          </div>
          {shown.map((session) => (
            <article key={session.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{session.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    対象期間: {session.startDate}〜{session.endDate}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={routes.generalQuestionsSession(session.slug)}>
                    会期別に見る
                  </Link>
                </Button>
              </div>
              {session.appearances.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {session.appearances.map((appearance) => (
                    <li key={appearance.id} className="rounded-lg bg-muted p-4">
                      <p className="font-semibold">
                        {appearance.heldOn ?? "開催日未確認"}　
                        {appearance.speakerName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {questionKindLabels[appearance.questionKind] ??
                          appearance.questionKind}
                        ・質問項目{" "}
                        {
                          appearance.items.filter(
                            (item) => item.parentItemId === null
                          ).length
                        }
                        件
                      </p>
                      {appearance.sourceUrl ? (
                        <a
                          href={appearance.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-accent underline"
                        >
                          公式資料
                          <ExternalLink className="size-4" aria-hidden="true" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  条件に一致する公開済み登壇枠はありません。
                </p>
              )}
            </article>
          ))}
        </section>

        <section aria-labelledby="topics-heading" className="space-y-4">
          <div>
            <h2
              id="topics-heading"
              className="text-2xl font-bold text-mirai-text"
            >
              政策分野の構成
            </h2>
            <p className="text-sm text-muted-foreground">
              質問項目ベースの複数分類です。分類体系:{" "}
              {taxonomyVersion ?? "公開準備中"}
            </p>
          </div>
          {visualization.topics.length === 0 ? (
            <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
              公開済みの政策分類はありません。
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-xl text-left text-sm">
                <caption className="p-4 text-left text-muted-foreground">
                  政策分野ごとの質問項目数と登壇枠数。点は最大20個まで表示します。
                </caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="p-3">
                      政策分野
                    </th>
                    <th scope="col" className="p-3">
                      項目数
                    </th>
                    <th scope="col" className="p-3">
                      登壇枠数
                    </th>
                    <th scope="col" className="p-3">
                      ドット表示
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visualization.topics.map((topic) => (
                    <tr key={topic.id} className="border-b last:border-0">
                      <th scope="row" className="p-3">
                        {topic.label}
                      </th>
                      <td className="p-3">{topic.itemCount}</td>
                      <td className="p-3">{topic.appearanceCount}</td>
                      <td className="p-3">
                        <span
                          className="flex flex-wrap gap-1"
                          aria-hidden="true"
                        >
                          {Array.from(
                            { length: Math.min(topic.itemCount, 20) },
                            (_, index) => (
                              <span
                                key={`${topic.id}-dot-${index}`}
                                className="size-3 rounded-full bg-chart-1"
                              />
                            )
                          )}
                        </span>
                        <span className="sr-only">{topic.itemCount}件</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="cooccurrence-heading" className="space-y-3">
          <div>
            <h2
              id="cooccurrence-heading"
              className="text-2xl font-bold text-mirai-text"
            >
              政策分野と答弁者役職の共起
            </h2>
            <p className="text-sm text-muted-foreground">
              同じ登壇枠への掲載を示します。質問への答弁回数や個別項目への答弁帰属ではありません。
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="p-4 text-left text-muted-foreground">
                政策分野と答弁者役職グループが同じ枠に掲載された登壇枠数
              </caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="p-3">
                    政策分野
                  </th>
                  <th scope="col" className="p-3">
                    役職グループ
                  </th>
                  <th scope="col" className="p-3">
                    登壇枠数
                  </th>
                </tr>
              </thead>
              <tbody>
                {visualization.cooccurrences.length ? (
                  visualization.cooccurrences.map((cell) => (
                    <tr
                      key={`${cell.topicId}-${cell.roleGroup}`}
                      className="border-b last:border-0"
                    >
                      <th scope="row" className="p-3">
                        {cell.topicLabel}
                      </th>
                      <td className="p-3">
                        {generalQuestionLabel(cell.roleGroup)}
                      </td>
                      <td className="p-3">{cell.appearanceCount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-4 text-muted-foreground">
                      公開済みの共起データはありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="continuity-heading" className="space-y-3">
          <div>
            <h2
              id="continuity-heading"
              className="text-2xl font-bold text-mirai-text"
            >
              継続テーマ
            </h2>
            <p className="text-sm text-muted-foreground">
              同じ政策分野が掲載された会期を示します。「解決済み」「未解決」の判定は行いません。
            </p>
          </div>
          {continuingTopics.length === 0 ? (
            <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
              複数会期に掲載された公開済みテーマはありません。
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {continuingTopics.map((topic) => (
                <li key={topic.id} className="rounded-xl border bg-card p-4">
                  <h3 className="font-bold">{topic.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {topic.sessionNames.join(" → ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="coverage-heading" className="space-y-3">
          <h2
            id="coverage-heading"
            className="text-2xl font-bold text-mirai-text"
          >
            データカバレッジ
          </h2>
          <ul className="space-y-3 sm:hidden">
            {coverageEntries.map(({ key, sessionName, coverage }) => (
              <li key={key} className="rounded-xl border bg-card p-4">
                <h3 className="font-medium">{sessionName}</h3>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">確認資料</dt>
                  <dd>
                    {coverage
                      ? generalQuestionLabel(coverage.sourceKind)
                      : "未確認"}
                  </dd>
                  <dt className="text-muted-foreground">状態</dt>
                  <dd>
                    {coverage
                      ? `${generalQuestionLabel(coverage.state)} / ${generalQuestionLabel(coverage.disposition)}`
                      : "未取得"}
                  </dd>
                  <dt className="text-muted-foreground">確認件数</dt>
                  <dd>
                    {coverage?.matchedCount == null
                      ? "不明"
                      : `${coverage.matchedCount}件`}
                  </dd>
                  <dt className="text-muted-foreground">確認日時</dt>
                  <dd>
                    {coverage?.checkedAt
                      ? formatDateTime(coverage.checkedAt)
                      : "未確認"}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
            <table className="w-full min-w-2xl border-collapse text-left text-sm">
              <caption className="p-4 text-left text-muted-foreground">
                会期ごとの一般質問資料の確認状態
              </caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="p-3">
                    会期
                  </th>
                  <th scope="col" className="p-3">
                    確認資料
                  </th>
                  <th scope="col" className="p-3">
                    状態
                  </th>
                  <th scope="col" className="p-3">
                    確認件数
                  </th>
                  <th scope="col" className="p-3">
                    確認日時
                  </th>
                </tr>
              </thead>
              <tbody>
                {coverageEntries.map(
                  ({
                    key,
                    sessionName,
                    coverage,
                    showSessionName,
                    sessionRowSpan,
                  }) => (
                    <tr key={key} className="border-b last:border-0">
                      {showSessionName ? (
                        <th
                          scope="rowgroup"
                          rowSpan={sessionRowSpan}
                          className="p-3 align-top font-medium"
                        >
                          {sessionName}
                        </th>
                      ) : null}
                      <td className="p-3">
                        {coverage
                          ? generalQuestionLabel(coverage.sourceKind)
                          : "未確認"}
                      </td>
                      <td className="p-3">
                        {coverage
                          ? `${generalQuestionLabel(coverage.state)} / ${generalQuestionLabel(coverage.disposition)}`
                          : "未取得"}
                      </td>
                      <td className="p-3">
                        {coverage?.matchedCount == null
                          ? "不明"
                          : `${coverage.matchedCount}件`}
                      </td>
                      <td className="p-3">
                        {coverage?.checkedAt
                          ? formatDateTime(coverage.checkedAt)
                          : "未確認"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
        <Breadcrumb
          items={[
            { label: "トップ", href: routes.home() },
            { label: "一般質問" },
          ]}
        />
      </Container>
    </div>
  );
}
