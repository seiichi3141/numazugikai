import "server-only";

import { generalQuestionLabel } from "@mirai-gikai/shared/general-questions/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GENERAL_QUESTION_SUMMARY_MAX_LENGTH } from "../../shared/utils/general-question-summary";
import {
  classifyGeneralQuestion,
  publishGeneralQuestionRelease,
} from "../actions/classify-general-question";
import { generateGeneralQuestionSummaryAction } from "../actions/generate-general-question-summaries";
import {
  applyGeneralQuestion,
  reviewGeneralQuestion,
} from "../actions/review-general-question";
import { loadGeneralQuestionQa } from "../loaders/load-general-question-qa";
import {
  findFailedGeneralQuestionImports,
  findGeneralQuestionClassifications,
} from "../repositories/general-question-qa-repository";

const labels = {
  new: "新規",
  changed: "変更あり",
  unchanged: "変更なし",
  missing: "資料から消滅",
  ambiguous: "要突合",
} as const;

const VISIBLE_QA_ROWS = 50;
const VISIBLE_CLASSIFICATION_ROWS = 50;

export async function GeneralQuestionQaPage({
  qaPage,
  classificationPage,
}: {
  qaPage: number;
  classificationPage: number;
}) {
  const [qaResult, classifications, failedImports] = await Promise.all([
    loadGeneralQuestionQa({ page: qaPage, pageSize: VISIBLE_QA_ROWS }),
    findGeneralQuestionClassifications({
      page: classificationPage,
      pageSize: VISIBLE_CLASSIFICATION_ROWS,
    }),
    findFailedGeneralQuestionImports(),
  ]);
  const qaPageCount = Math.max(
    1,
    Math.ceil(qaResult.totalCount / VISIBLE_QA_ROWS)
  );
  const safeQaPage = qaResult.page;
  const classificationPageCount = Math.max(
    1,
    Math.ceil(classifications.totalCount / VISIBLE_CLASSIFICATION_ROWS)
  );
  const safeClassificationPage = classifications.page;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">一般質問QA</h1>
        <p className="mt-2 text-muted-foreground">
          公式資料の解析結果を原資料と照合してから承認します。未確認データは公開されません。
        </p>
      </div>
      <p aria-live="polite" className="rounded-xl border bg-card p-4 shadow-sm">
        未確認の登壇枠: {qaResult.pendingCount}件（全{qaResult.totalCount}件中、
        {safeQaPage} / {qaPageCount}ページ）
      </p>
      {failedImports.length > 0 ? (
        <section
          aria-labelledby="failed-imports-heading"
          className="space-y-3 rounded-xl border border-destructive bg-card p-4 shadow-sm"
        >
          <h2
            id="failed-imports-heading"
            className="font-semibold text-destructive"
          >
            解析に失敗した資料（履歴）: {failedImports.length}件
          </h2>
          <p className="text-sm text-muted-foreground">
            登壇枠を抽出できなかったため公開候補は作成されていません。同じ取得版を次回取込みで再解析できます。
          </p>
          <ul className="space-y-2 text-sm">
            {failedImports.map((failedImport) => (
              <li key={failedImport.id}>
                {failedImport.sourceUrl ? (
                  <a
                    href={failedImport.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    {failedImport.sourceTitle}
                  </a>
                ) : (
                  <span className="font-medium">
                    {failedImport.sourceTitle}
                  </span>
                )}
                : {failedImport.errors.join("、") || "解析失敗"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {qaResult.totalCount === 0 ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          取込み待ちです。一般質問の公式資料を解析すると、ここに確認対象が表示されます。
        </div>
      ) : (
        <div className="space-y-4">
          {qaResult.items.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {labels[row.changeKind]} ・ {row.heldOn ?? "開催日不明"} ・{" "}
                    {row.sourceKind === "general_question_record"
                      ? "会議記録"
                      : "一般質問資料PDF"}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {row.speakerName}
                  </h2>
                </div>
                <Badge variant="outline">
                  {row.qaStatus === "pending"
                    ? "未確認"
                    : row.qaStatus === "verified"
                      ? "確認済み"
                      : "却下"}
                </Badge>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium">質問種別</dt>
                  <dd>{generalQuestionLabel(row.questionKind)}</dd>
                </div>
                <div>
                  <dt className="font-medium">質問方式</dt>
                  <dd>{generalQuestionLabel(row.deliveryMethod)}</dd>
                </div>
                <div>
                  <dt className="font-medium">質問項目</dt>
                  <dd>{row.items.length}件</dd>
                </div>
                <div>
                  <dt className="font-medium">答弁者</dt>
                  <dd>{row.answerers.join("、") || "未抽出"}</dd>
                </div>
              </dl>
              {row.validationErrors.length > 0 ? (
                <div
                  role="alert"
                  className="mt-4 rounded-md border border-destructive p-3 text-sm text-destructive"
                >
                  <p className="font-semibold">
                    解析検証エラーがあるため、このバッチは承認できません。
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {row.validationErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {row.sourceKind === "general_question_record" ? (
                <div className="mt-4 rounded-md border p-3 text-sm text-muted-foreground">
                  <p>
                    会議記録由来の補完データです。質問種別・方式・項目はPDFと同等の完全性を持たないため、原資料とAI要約を特に慎重に確認してください。
                  </p>
                  <p className="mt-1">
                    同日のPDF由来データがある場合だけ既存の登壇枠へ突合し、PDFがない年代はAI要約を人手確認して新しい登壇枠として登録します。
                  </p>
                </div>
              ) : null}
              {row.items.length > 0 ? (
                <section
                  className="mt-4 space-y-3"
                  aria-label="質問項目と公開用AI要約"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">質問項目と公開用AI要約</h3>
                      <p className="text-sm text-muted-foreground">
                        原文見出しは照合用です。AI要約を原資料と比較し、必要なら編集してから承認してください。
                      </p>
                    </div>
                    {row.qaStatus === "pending" &&
                    row.changeKind !== "unchanged" &&
                    row.changeKind !== "missing" &&
                    row.changeKind !== "ambiguous" &&
                    row.validationErrors.length === 0 ? (
                      <form action={generateGeneralQuestionSummaryAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <Button type="submit" variant="outline">
                          {row.summaryGenerationModel
                            ? "AI要約を再生成"
                            : "AI要約を生成"}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                  {row.summaryGenerationModel ? (
                    <p className="text-xs text-muted-foreground">
                      生成モデル: {row.summaryGenerationModel} / プロンプト版:{" "}
                      {row.summaryPromptVersion}
                    </p>
                  ) : null}
                  <ol className="space-y-3">
                    {row.items.map((item) => (
                      <li
                        key={item.sourceKey}
                        className="rounded-md border p-3"
                      >
                        <p className="text-sm">
                          <span className="font-medium">原文見出し:</span>{" "}
                          {item.label}
                        </p>
                        {row.changeKind === "unchanged" ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            内容に変更がないため、公開済みのAI要約を維持します。
                          </p>
                        ) : row.qaStatus === "pending" &&
                          item.generatedSummary ? (
                          <label
                            htmlFor={`summary-${row.id}-${item.sourceKey}`}
                            className="mt-2 block text-sm font-medium"
                          >
                            公開用要約（人手確認・編集）
                            <input
                              type="hidden"
                              name="summaryKey"
                              value={item.sourceKey}
                              form={`review-${row.id}`}
                            />
                            <Textarea
                              id={`summary-${row.id}-${item.sourceKey}`}
                              name="summaryValue"
                              form={`review-${row.id}`}
                              required
                              maxLength={GENERAL_QUESTION_SUMMARY_MAX_LENGTH}
                              defaultValue={
                                item.reviewedSummary ?? item.generatedSummary
                              }
                              className="mt-1 min-h-16 font-normal"
                            />
                          </label>
                        ) : item.reviewedSummary ? (
                          <p className="mt-2 text-sm">
                            <span className="font-medium">公開用要約:</span>{" "}
                            {item.reviewedSummary}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            AI要約は未生成です。
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
              {row.qaStatus === "pending" ? (
                <form
                  id={`review-${row.id}`}
                  action={reviewGeneralQuestion}
                  className="mt-4 space-y-3"
                >
                  <input type="hidden" name="id" value={row.id} />
                  <label
                    className="block text-sm font-medium"
                    htmlFor={`note-${row.id}`}
                  >
                    確認メモ
                  </label>
                  <Textarea
                    id={`note-${row.id}`}
                    name="reviewNote"
                    className="min-h-20"
                  />
                  {row.heldOn === null ? (
                    <label
                      htmlFor={`held-on-${row.id}`}
                      className="block text-sm font-medium"
                    >
                      開催日（公式資料で確認）
                      <Input
                        id={`held-on-${row.id}`}
                        type="date"
                        name="reviewedHeldOn"
                        required
                        className="mt-1 w-auto"
                      />
                    </label>
                  ) : null}
                  {row.matchCandidates.length > 0 ? (
                    <label className="block text-sm font-medium">
                      既存の登壇枠との突合
                      <select
                        name="reviewedMatchedAppearanceId"
                        defaultValue={
                          row.reviewedMatchedAppearanceId ??
                          row.matchedAppearanceId ??
                          ""
                        }
                        required={
                          row.sourceKind === "general_question_record" &&
                          !row.summaryGenerationModel
                        }
                        className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="">新しい登壇枠として登録</option>
                        {row.matchCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.label}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block font-normal text-muted-foreground">
                        同日のPDF由来データと同一人物だと公式資料で確認できる場合だけ選択します。
                      </span>
                    </label>
                  ) : null}
                  <div className="flex gap-2">
                    {row.changeKind !== "missing" &&
                    row.changeKind !== "ambiguous" &&
                    row.validationErrors.length === 0 &&
                    (row.changeKind === "unchanged" ||
                      row.items.length === 0 ||
                      (row.sourceKind === "general_question_record" &&
                        row.matchCandidates.length > 0) ||
                      row.summaryGenerationModel) ? (
                      <Button type="submit" name="decision" value="verified">
                        承認
                      </Button>
                    ) : null}
                    <Button
                      type="submit"
                      name="decision"
                      value="rejected"
                      variant="outline"
                      formNoValidate
                    >
                      却下
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 space-y-3">
                  {row.reviewNote ? (
                    <p className="text-sm">確認メモ: {row.reviewNote}</p>
                  ) : null}
                  {row.qaStatus === "verified" && !row.applied ? (
                    <form action={applyGeneralQuestion}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button type="submit">公開データへ反映</Button>
                    </form>
                  ) : row.applied ? (
                    <p className="text-sm font-medium text-primary-accent">
                      公開データへ反映済み
                    </p>
                  ) : null}
                </div>
              )}
            </article>
          ))}
          <PaginationForms
            pageName="qaPage"
            page={safeQaPage}
            pageCount={qaPageCount}
            preservedName="classificationPage"
            preservedPage={safeClassificationPage}
          />
        </div>
      )}
      <section className="space-y-4 border-t pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">政策分野の人手分類</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              公開済みの質問項目を複数の政策分野へ分類します。
            </p>
          </div>
          <form
            action={publishGeneralQuestionRelease}
            className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[minmax(0,12rem)_auto]"
          >
            <label
              htmlFor="general-question-release-key"
              className="min-w-0 text-sm font-medium"
            >
              <span className="sr-only">releaseキー</span>
              <Input
                id="general-question-release-key"
                name="releaseKey"
                required
                placeholder="2026-09-v1"
                className="w-full min-w-0"
              />
            </label>
            <Button
              type="submit"
              variant="outline"
              className="w-full sm:w-auto"
            >
              分類releaseを公開
            </Button>
          </form>
        </div>
        <p className="text-sm text-muted-foreground">
          全{classifications.totalCount}件中、{safeClassificationPage} /{" "}
          {classificationPageCount}
          ページ
        </p>
        {classifications.items.map((item) => (
          <article
            key={item.itemRevisionId}
            className="rounded-xl border bg-card p-5 shadow-sm"
          >
            <p className="text-sm text-muted-foreground">{item.speakerName}</p>
            <h3 className="mt-1 font-semibold">{item.summary}</h3>
            {item.classifiedTopicLabels.length ? (
              <p className="mt-2 text-sm">
                現在の分類: {item.classifiedTopicLabels.join("、")}
              </p>
            ) : null}
            <form action={classifyGeneralQuestion} className="mt-3 space-y-3">
              <input
                type="hidden"
                name="itemRevisionId"
                value={item.itemRevisionId}
              />
              <fieldset>
                <legend className="text-sm font-medium">
                  政策分野（複数選択可）
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {classifications.topics.map((topic) => (
                    <label
                      key={topic.id}
                      htmlFor={`topic-${item.itemRevisionId}-${topic.id}`}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Checkbox
                        id={`topic-${item.itemRevisionId}-${topic.id}`}
                        name="topicId"
                        value={topic.id}
                        defaultChecked={item.classifiedTopicIds.includes(
                          topic.id
                        )}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium">{topic.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {topic.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit">分類を確定</Button>
            </form>
          </article>
        ))}
        <PaginationForms
          pageName="classificationPage"
          page={safeClassificationPage}
          pageCount={classificationPageCount}
          preservedName="qaPage"
          preservedPage={safeQaPage}
        />
      </section>
    </div>
  );
}

function PaginationForms({
  pageName,
  page,
  pageCount,
  preservedName,
  preservedPage,
}: {
  pageName: "qaPage" | "classificationPage";
  page: number;
  pageCount: number;
  preservedName: "qaPage" | "classificationPage";
  preservedPage: number;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="ページ移動"
      className="flex items-center justify-center gap-3"
    >
      <form method="get">
        <input type="hidden" name={pageName} value={page - 1} />
        <input type="hidden" name={preservedName} value={preservedPage} />
        <Button type="submit" variant="outline" disabled={page <= 1}>
          前のページ
        </Button>
      </form>
      <span className="text-sm">
        {page} / {pageCount}
      </span>
      <form method="get">
        <input type="hidden" name={pageName} value={page + 1} />
        <input type="hidden" name={preservedName} value={preservedPage} />
        <Button type="submit" variant="outline" disabled={page >= pageCount}>
          次のページ
        </Button>
      </form>
    </nav>
  );
}
