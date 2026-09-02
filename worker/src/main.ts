import {
  type AnalysisStrategy,
  runAnalysis,
  runAnalyzeAll,
} from "@mirai-gikai/topic-analysis-core/analyze";
import { runBackfill } from "@mirai-gikai/topic-analysis-core/backfill";
import { resolveBackfillParams } from "@mirai-gikai/topic-analysis-core/backfill-params";
import { runTagBackfill } from "@mirai-gikai/topic-analysis-core/tag-backfill";
import { runAssignThumbnailKeys } from "@mirai-gikai/bill-explainer/assign-thumbnail-keys";
import { runExplain } from "@mirai-gikai/bill-explainer/explain";
import { runIngest, type IngestMode } from "@mirai-gikai/numazu-ingest/ingest";

/**
 * Cloud Run Job のエントリポイント。
 *
 * 起動例:
 *   tsx src/main.ts --mode=analyze --bill-id=<uuid> --version-id=<uuid>                 # フル分析（既定）
 *   tsx src/main.ts --mode=analyze --bill-id=<uuid> --version-id=<uuid> --strategy=incremental # 差分（増分）
 *   tsx src/main.ts --mode=analyze-all                                   # 全議案・差分（既定 incremental）
 *   tsx src/main.ts --mode=analyze-all --strategy=full                   # 全議案・フル
 *   tsx src/main.ts --mode=backfill                              # 未再抽出を全議案で処理
 *   tsx src/main.ts --mode=backfill --bill-id=<uuid>             # 指定議案の未再抽出のみ
 *   tsx src/main.ts --mode=backfill --bill-id=<uuid> --scope=all # 指定議案を全件やり直し
 *   tsx src/main.ts --mode=backfill --model=openai/gpt-5.2       # 使用モデルを指定（省略時は既定）
 *   tsx src/main.ts --mode=tag-backfill                          # タグ未抽出の意見を全議案で処理
 *   tsx src/main.ts --mode=tag-backfill --bill-id=<uuid>         # 指定議案のタグ未抽出のみ
 *   tsx src/main.ts --mode=tag-backfill --bill-id=<uuid> --scope=all # 指定議案のタグを全件やり直し
 *
 *   沼津市議会の公開情報の取り込み（AIは使わない）:
 *   tsx src/main.ts --mode=ingest --target=all                        # 会期・議員・議案をまとめて
 *   tsx src/main.ts --mode=ingest --target=sessions                   # 定例会の会期予定
 *   tsx src/main.ts --mode=ingest --target=members                    # 会派・議員
 *   tsx src/main.ts --mode=ingest --target=bills                      # 当年の定例会の議案
 *   tsx src/main.ts --mode=ingest --target=minutes                    # 議会中継の会議録から議案説明・討論
 *   tsx src/main.ts --mode=ingest --target=amivoice                   # 会議記録検索システムから議案説明・委員会審査・討論
 *   tsx src/main.ts --mode=ingest --target=amivoice-archive           # 過去の委員会記録（検索経由・2015年〜）
 *   tsx src/main.ts --mode=ingest --target=amivoice-archive --year=2019
 *
 *   議案解説の生成（OpenAI API を直接利用。Gateway は経由しない）:
 *   tsx src/main.ts --mode=explain --session=2026-13                  # 指定会期の議案を解説
 *   tsx src/main.ts --mode=explain --session=2026-13 --limit=3        # 件数を絞って試す
 *   tsx src/main.ts --mode=explain --difficulty=normal                # やさしい版だけ
 *   tsx src/main.ts --mode=explain --force                            # 既存の解説を作り直す
 *
 *   サムネイルの題材の割り当て（explain の後にも自動で走る）:
 *   tsx src/main.ts --mode=thumbnail-keys                             # 題材が未設定の議案すべて
 *   tsx src/main.ts --mode=thumbnail-keys --session=2026-13 --force   # 指定会期を決め直す
 *   tsx src/main.ts --mode=ingest --target=bills --era-year=8 --month=6  # 令和8年6月定例会だけ
 *   tsx src/main.ts --mode=ingest --target=bills --term=24            # 第24期の全会期
 *   tsx src/main.ts --mode=ingest --target=bills --all-terms          # 全期（平成16年〜）
 *   tsx src/main.ts --mode=ingest --target=bills --force              # 内容が同じでも取り込み直す
 *
 * 必須env: SUPABASE_URL, SUPABASE_SECRET_KEY
 *   （ingest 以外のモードでは AI_GATEWAY_API_KEY も必要）
 */

type Mode =
  | "analyze"
  | "analyze-all"
  | "backfill"
  | "tag-backfill"
  | "ingest"
  | "explain"
  | "thumbnail-keys";

const INGEST_TARGETS = [
  "sessions",
  "members",
  "bills",
  "minutes",
  "amivoice",
  "amivoice-archive",
  "all",
] as const;

/** --target をパースする。未指定は all。 */
function parseIngestTarget(value: string | undefined): IngestMode {
  if (value === undefined) return "all";
  if ((INGEST_TARGETS as readonly string[]).includes(value)) {
    return value as IngestMode;
  }
  throw new Error(
    `Invalid --target=${value} (expected ${INGEST_TARGETS.join(" / ")})`
  );
}

/** `--force` / `--force=true` を真、未指定と `--force=false` を偽にする。 */
function parseFlag(value: string | undefined): boolean {
  return value !== undefined && value !== "false";
}

/** `--era-year=8` のような数値引数をパースする。 */
function parseNumber(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${label}=${value} (expected a positive integer)`);
  }
  return parsed;
}

/** --strategy をパースする（未指定・不正値は fallback）。 */
function parseStrategy(
  value: string | undefined,
  fallback: AnalysisStrategy
): AnalysisStrategy {
  if (value === "full" || value === "incremental") return value;
  if (value !== undefined) {
    throw new Error(
      `Invalid --strategy=${value} (expected "full" or "incremental")`
    );
  }
  return fallback;
}

/** サムネイル題材の割り当てを実行し、件数を出す。 */
async function assignThumbnailKeys(options: {
  sessionSlug?: string;
  billIds?: string[];
  force?: boolean;
  limit?: number;
}): Promise<void> {
  const results = await runAssignThumbnailKeys(options);
  const assigned = results.filter((r) => r.key !== null).length;
  console.log(
    `サムネイル題材の割り当て完了: 対象${results.length}件 / 決定${assigned}件 / 失敗${results.length - assigned}件`
  );
}

/**
 * `--key=value` 形式の引数をパースする（Cloud Run の --args 渡しに合わせる）。
 * `--force` のように値が無いものは "true" として扱い、parseFlag で真になる。
 */
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) out[match[1]] = match[2] ?? "true";
  }
  return out;
}

function requireEnv(name: string): void {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mode as Mode | undefined;

  // 接続情報が無ければ即座に失敗させる（部分実行を避ける）。
  requireEnv("SUPABASE_URL");
  requireEnv("SUPABASE_SECRET_KEY");
  // 取り込みはLLMを使わないためAIのキーは不要。
  // 議案解説とサムネイル題材の割り当ては OpenAI API を直接叩くため、Gateway ではなく OPENAI_API_KEY を要求する。
  if (mode === "explain" || mode === "thumbnail-keys") {
    requireEnv("OPENAI_API_KEY");
  } else if (mode !== "ingest") {
    requireEnv("AI_GATEWAY_API_KEY");
  }

  if (mode === "explain") {
    const difficulty = args.difficulty;
    if (difficulty !== undefined && difficulty !== "normal" && difficulty !== "hard") {
      throw new Error(
        `Invalid --difficulty=${difficulty} (expected "normal" or "hard")`
      );
    }
    const results = await runExplain({
      sessionSlug: args.session,
      force: parseFlag(args.force),
      limit: parseNumber(args.limit, "limit"),
      difficulties: difficulty ? [difficulty] : undefined,
    });
    const generated = results.filter((r) => r.generated.length > 0).length;
    const failed = results.filter((r) => r.failures.length > 0).length;
    console.log(
      `議案解説の生成完了: 対象${results.length}件 / 生成${generated}件 / 一部失敗${failed}件`
    );
    // 解説ができた議案は要約が変わっているので、その議案だけ題材を決め直す。
    const explainedIds = results
      .filter((r) => r.generated.length > 0)
      .map((r) => r.billId);
    if (explainedIds.length > 0) {
      await assignThumbnailKeys({ billIds: explainedIds, force: true });
    }
    return;
  }

  if (mode === "thumbnail-keys") {
    await assignThumbnailKeys({
      sessionSlug: args.session,
      force: parseFlag(args.force),
      limit: parseNumber(args.limit, "limit"),
    });
    return;
  }

  if (mode === "ingest") {
    await runIngest({
      mode: parseIngestTarget(args.target),
      eraYear: parseNumber(args["era-year"], "era-year"),
      month: parseNumber(args.month, "month"),
      term: parseNumber(args.term, "term"),
      year: parseNumber(args.year, "year"),
      allTerms: parseFlag(args["all-terms"]),
      force: parseFlag(args.force),
    });
    return;
  }

  if (mode === "analyze") {
    const versionId = args["version-id"];
    const billId = args["bill-id"];
    if (!versionId || !billId) {
      throw new Error(
        "analyze mode requires --version-id=<uuid> and --bill-id=<uuid>"
      );
    }
    const strategy = parseStrategy(args.strategy, "full");
    await runAnalysis(versionId, billId, strategy);
    return;
  }

  if (mode === "analyze-all") {
    // 全議案を順次分析（既定は増分）。version 行は各議案ごとに内部で作成する。
    const strategy = parseStrategy(args.strategy, "incremental");
    await runAnalyzeAll(strategy);
    return;
  }

  if (mode === "backfill") {
    const resolved = resolveBackfillParams({
      billId: args["bill-id"],
      scope: args.scope,
      model: args.model,
    });
    if (!resolved.ok) {
      throw new Error(`backfill mode: ${resolved.error}`);
    }
    await runBackfill(resolved.params);
    return;
  }

  // 既存意見へタグ（concern/proposal/reasoning_types）だけを追加する経路。
  // 意見の本文は再生成しないため、公開中のトピック分析の引用が動かない。
  if (mode === "tag-backfill") {
    const resolved = resolveBackfillParams({
      billId: args["bill-id"],
      scope: args.scope,
      model: args.model,
    });
    if (!resolved.ok) {
      throw new Error(`tag-backfill mode: ${resolved.error}`);
    }
    await runTagBackfill(resolved.params);
    return;
  }

  throw new Error(
    `Unknown --mode=${mode ?? "(none)"} (expected "analyze" / "analyze-all" / "backfill" / "tag-backfill" / "ingest" / "explain")`
  );
}

main()
  .then(() => {
    console.log("[worker] done");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[worker] failed:", error);
    process.exit(1);
  });
