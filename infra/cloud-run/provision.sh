#!/usr/bin/env bash
#
# トピック分析 Cloud Run Job 実行基盤の冪等プロビジョニングスクリプト。
# docs/20260609_1230_…プロビジョニング手順.md の gcloud 手順をコード化したもの。
#
# 何度実行しても安全（既存リソースは describe で検知して skip、IAM binding は冪等）。
# OSS のため project ID や secret 値はスクリプトに埋め込まず、すべて env で注入する。
#
# 使い方:
#   cp infra/cloud-run/config.example.env infra/cloud-run/config.env   # 実値を記入（gitignore 済み）
#   gcloud auth login                                                  # 事前に認証
#   bash infra/cloud-run/provision.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 設定ファイルを読み込む（実値はここに置く・config.env* は gitignore 済み）。
# 環境ごとに分けたい場合は CONFIG_FILE で指定する:
#   CONFIG_FILE=infra/cloud-run/config.env.staging bash infra/cloud-run/provision.sh
# 既定は config.env。相対パス指定はカレントからでも SCRIPT_DIR 基準でも解決できるようにする。
CONFIG_FILE="${CONFIG_FILE:-${SCRIPT_DIR}/config.env}"
if [[ ! -f "$CONFIG_FILE" && -f "${SCRIPT_DIR}/${CONFIG_FILE}" ]]; then
  CONFIG_FILE="${SCRIPT_DIR}/${CONFIG_FILE}"
fi
if [[ -f "$CONFIG_FILE" ]]; then
  echo "▶ 設定ファイルを読み込み: ${CONFIG_FILE}"
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

# ── 設定（プロジェクト識別子以外は汎用デフォルトを持つ） ──
PROJECT_ID="${GCP_PROJECT_ID:-}"
# 環境（staging / production 等）。同一プロジェクトに複数環境を同居させる前提で、
# Secret 名と Job 名をこの値で分離する（必須）。
DEPLOY_ENV="${DEPLOY_ENV:-}"
REGION="${GCP_REGION:-asia-northeast1}"
AR_REPO="${GCP_AR_REPO:-topic-analysis}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-topic-analysis-runtime}"
INVOKER_SA_NAME="${INVOKER_SA_NAME:-topic-analysis-invoker}"
DEPLOYER_SA_NAME="${DEPLOYER_SA_NAME:-topic-analysis-deployer}"
SCHEDULER_SA_NAME="${SCHEDULER_SA_NAME:-topic-analysis-scheduler}"
WORKER_IMAGE="${WORKER_IMAGE:-}"      # 空なら初回 Job 作成時に bootstrap をビルド
GENERATE_KEYS="${GENERATE_KEYS:-0}"   # 1 のとき SA キーを発行（既定は無効＝安全側）
# Cloud Scheduler（定期実行）。cron 式と一時停止フラグは環境ごとに config.env で調整する。
SCHEDULER_CRON="${SCHEDULER_CRON:-0 6 * * *}"
SCHEDULER_TIMEZONE="${SCHEDULER_TIMEZONE:-Asia/Tokyo}"
SCHEDULER_PAUSED="${SCHEDULER_PAUSED:-0}"   # 1 のとき一時停止状態にする（リソースは作る）
INGEST_SCHEDULER_CRON="${INGEST_SCHEDULER_CRON:-30 6,18 * * *}"
INGEST_SCHEDULER_TIMEZONE="${INGEST_SCHEDULER_TIMEZONE:-Asia/Tokyo}"
INGEST_SCHEDULER_PAUSED="${INGEST_SCHEDULER_PAUSED:-0}"
INGEST_DAILY_SCHEDULER_CRON="${INGEST_DAILY_SCHEDULER_CRON:-30 20 * * *}"
INGEST_DAILY_SCHEDULER_TIMEZONE="${INGEST_DAILY_SCHEDULER_TIMEZONE:-Asia/Tokyo}"
INGEST_DAILY_SCHEDULER_PAUSED="${INGEST_DAILY_SCHEDULER_PAUSED:-0}"
MONITORING_ALERTS_ENABLED="${MONITORING_ALERTS_ENABLED:-1}"
MONITORING_NOTIFICATION_CHANNELS="${MONITORING_NOTIFICATION_CHANNELS:-}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: GCP_PROJECT_ID が未設定です（config.env か環境変数で指定）。" >&2
  exit 1
fi
if [[ -z "$DEPLOY_ENV" ]]; then
  echo "ERROR: DEPLOY_ENV が未設定です（例: staging / production）。" >&2
  echo "       Secret Manager はプロジェクトでグローバルなため、環境を指定しないと" >&2
  echo "       他環境のシークレットを上書きする恐れがあります。" >&2
  exit 1
fi
if [[ "$MONITORING_ALERTS_ENABLED" == "1" && "$DEPLOY_ENV" == "production" \
  && -z "$MONITORING_NOTIFICATION_CHANNELS" ]]; then
  echo "ERROR: production では MONITORING_NOTIFICATION_CHANNELS が必要です。" >&2
  echo "       projects/<project>/notificationChannels/<id> をカンマ区切りで指定してください。" >&2
  exit 1
fi
if [[ "$MONITORING_ALERTS_ENABLED" == "1" ]] && ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: Cloud Monitoringのalert policy構築には jq が必要です。" >&2
  exit 1
fi

# Secret はプロジェクトでグローバル（名前が一意）。同一プロジェクトに複数環境を
# 置くため、Secret 名を環境サフィックスで分離する（例: SUPABASE_URL_STAGING）。
# Job 名も環境ごとに分ける。いずれも明示指定で上書き可能。
ENV_UPPER="$(printf '%s' "$DEPLOY_ENV" | tr '[:lower:]' '[:upper:]')"
SECRET_SUFFIX="${SECRET_SUFFIX:-_${ENV_UPPER}}"
JOB="${GCP_TOPIC_ANALYSIS_JOB:-topic-analysis-worker-${DEPLOY_ENV}}"
SCHEDULER_JOB="${SCHEDULER_JOB_NAME:-topic-analysis-cron-${DEPLOY_ENV}}"
INGEST_SCHEDULER_JOB="${INGEST_SCHEDULER_JOB_NAME:-numazu-ingest-cron-${DEPLOY_ENV}}"
INGEST_DAILY_SCHEDULER_JOB="${INGEST_DAILY_SCHEDULER_JOB_NAME:-numazu-ingest-daily-cron-${DEPLOY_ENV}}"

RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
INVOKER_SA="${INVOKER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_SA="${DEPLOYER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SA="${SCHEDULER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
# worker が読む環境変数名（固定）。実体の Secret 名は ${ENV_VAR}${SECRET_SUFFIX}。
# OPENAI_API_KEY は議案解説の生成とサムネイル題材の割り当て（OpenAI API を直接呼ぶ）に使う
SECRET_ENV_VARS=(SUPABASE_URL SUPABASE_SECRET_KEY AI_GATEWAY_API_KEY OPENAI_API_KEY)
# この環境で作成・参照する実 Secret 名。
SECRETS=()
for ev in "${SECRET_ENV_VARS[@]}"; do
  SECRETS+=("${ev}${SECRET_SUFFIX}")
done

log() { echo "▶ $*"; }
log "環境: DEPLOY_ENV=${DEPLOY_ENV} / Secret 接尾辞=${SECRET_SUFFIX} / Job=${JOB}"

gcloud config set project "$PROJECT_ID" >/dev/null

# ── 1. API 有効化（services enable は冪等） ──
log "API 有効化 (run / artifactregistry / secretmanager / cloudscheduler / logging / monitoring)"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  --project "$PROJECT_ID"

# ── 2. Artifact Registry リポジトリ ──
if gcloud artifacts repositories describe "$AR_REPO" \
  --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  log "AR repo '$AR_REPO' は既存（skip）"
else
  log "AR repo '$AR_REPO' を作成"
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location "$REGION" \
    --project "$PROJECT_ID" \
    --description="Topic analysis worker images"
fi

# ── 3. Secret Manager（環境別の実 Secret 名で作成。値は SECRET_VALUE_<ENV_VAR> があれば version 追加） ──
# 値の指定は worker の環境変数名で行う（例: SECRET_VALUE_SUPABASE_URL）。
# 実 Secret 名は環境サフィックス付き（例: SUPABASE_URL_STAGING）に分離して衝突を防ぐ。
for ev in "${SECRET_ENV_VARS[@]}"; do
  s="${ev}${SECRET_SUFFIX}"
  if gcloud secrets describe "$s" --project "$PROJECT_ID" >/dev/null 2>&1; then
    log "secret '$s' は既存（コンテナ skip）"
  else
    log "secret '$s' を作成（空コンテナ）"
    gcloud secrets create "$s" \
      --replication-policy="automatic" --project "$PROJECT_ID"
  fi
  # 値はスクリプトに埋め込まず env から（あれば）。キーは環境変数名で統一: SECRET_VALUE_SUPABASE_URL など。
  val_var="SECRET_VALUE_${ev}"
  val="${!val_var:-}"
  if [[ -n "$val" ]]; then
    log "secret '$s' に新しい version を追加"
    printf '%s' "$val" | gcloud secrets versions add "$s" \
      --data-file=- --project "$PROJECT_ID" >/dev/null
  elif ! gcloud secrets versions list "$s" \
    --project "$PROJECT_ID" --format="value(name)" 2>/dev/null | grep -q .; then
    echo "  ⚠ secret '$s' に値が未登録です。SECRET_VALUE_${ev} を設定して再実行するか、" \
      "手動で 'gcloud secrets versions add $s --data-file=-' で値を入れてください。" >&2
  fi
done

# ── 4. サービスアカウント（冪等作成） ──
ensure_sa() {
  local name="$1" display="$2"
  local email="${name}@${PROJECT_ID}.iam.gserviceaccount.com"
  if gcloud iam service-accounts describe "$email" \
    --project "$PROJECT_ID" >/dev/null 2>&1; then
    log "SA '$name' は既存（skip）"
  else
    log "SA '$name' を作成"
    gcloud iam service-accounts create "$name" \
      --display-name="$display" --project "$PROJECT_ID"
  fi
}
ensure_sa "$RUNTIME_SA_NAME" "Topic Analysis Worker Runtime"
ensure_sa "$INVOKER_SA_NAME" "Topic Analysis Job Invoker (admin)"
ensure_sa "$DEPLOYER_SA_NAME" "Topic Analysis Worker Deployer (CI)"
ensure_sa "$SCHEDULER_SA_NAME" "Topic Analysis Scheduler (cron)"

# ── 5. runtime SA に各 secret の読み取り権限（add-iam-policy-binding は冪等） ──
for s in "${SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" >/dev/null
done
log "runtime SA に secretmanager.secretAccessor を付与"

# ── 6. Cloud Run Job（無ければ作成。以後の image 更新は CI=deploy_worker.yml に委譲） ──
if gcloud run jobs describe "$JOB" \
  --region "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  log "Job '$JOB' は既存（image 更新は CI に委譲・skip）"
else
  if [[ -z "$WORKER_IMAGE" ]]; then
    WORKER_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/topic-analysis-worker:bootstrap"
    log "初回 Job 作成用に bootstrap イメージをビルド & push: $WORKER_IMAGE"
    gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
    # Cloud Run は linux/amd64 のみ。Apple Silicon 等でも amd64 を明示してビルドする
    # （未指定だとホストarch=arm64 になり「container failed to start」で即死する）。
    docker build --platform linux/amd64 \
      -f "${REPO_ROOT}/worker/Dockerfile" -t "$WORKER_IMAGE" "$REPO_ROOT"
    docker push "$WORKER_IMAGE"
  fi
  # env 変数名（固定）→ 環境別 Secret 名（接尾辞付き）のマッピングを組み立てる。
  set_secrets=""
  for ev in "${SECRET_ENV_VARS[@]}"; do
    set_secrets+="${ev}=${ev}${SECRET_SUFFIX}:latest,"
  done
  set_secrets="${set_secrets%,}"
  log "Job '$JOB' を作成（batch 向け: tasks=1 / parallelism=1 / retry=1 / timeout=3600s）"
  log "  --set-secrets ${set_secrets}"
  gcloud run jobs create "$JOB" \
    --image "$WORKER_IMAGE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --service-account "$RUNTIME_SA" \
    --set-secrets "$set_secrets" \
    --max-retries 1 \
    --task-timeout 3600 \
    --tasks 1 \
    --parallelism 1 \
    --cpu 1 \
    --memory 1Gi
fi

# ── 7. invoker / scheduler SA（Job を起動する側）: jobs.run + jobs.runWithOverrides + actAs ──
# admin・Cloud Scheduler とも overrides（--mode 等の args 上書き）で起動するため
# run.jobs.runWithOverrides が要る。roles/run.invoker には含まれないので、
# 最小権限のカスタムロールを定義して付与する
# （roles/run.developer は job 更新・削除まで許してしまい broad すぎるため避ける）。
INVOKER_ROLE_ID="topicAnalysisJobInvoker"
if gcloud iam roles describe "$INVOKER_ROLE_ID" \
  --project "$PROJECT_ID" >/dev/null 2>&1; then
  log "custom role '$INVOKER_ROLE_ID' は既存（権限を更新）"
  gcloud iam roles update "$INVOKER_ROLE_ID" --project "$PROJECT_ID" \
    --permissions="run.jobs.run,run.jobs.runWithOverrides" --quiet >/dev/null
else
  log "custom role '$INVOKER_ROLE_ID' を作成"
  gcloud iam roles create "$INVOKER_ROLE_ID" --project "$PROJECT_ID" \
    --title="Topic Analysis Job Invoker" \
    --description="Execute the topic-analysis Cloud Run job (with overrides)" \
    --permissions="run.jobs.run,run.jobs.runWithOverrides" >/dev/null
fi
for sa in "$INVOKER_SA" "$SCHEDULER_SA"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${sa}" \
    --role="projects/${PROJECT_ID}/roles/${INVOKER_ROLE_ID}" \
    --condition=None >/dev/null
  gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
    --project "$PROJECT_ID" \
    --member="serviceAccount:${sa}" \
    --role="roles/iam.serviceAccountUser" >/dev/null
done
log "invoker / scheduler SA に jobs.run/runWithOverrides（custom role）+ runtime SA への actAs を付与"

# ── 8. Cloud Scheduler（定期実行）──
# run.jobs.run（Cloud Run Admin API v2）をOAuthで叩き、argsを上書きする。
RUN_JOB_URI="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB}:run"

ensure_scheduler() {
  local scheduler_job="$1"
  local scheduler_cron="$2"
  local scheduler_timezone="$3"
  local scheduler_paused="$4"
  local scheduler_body="$5"
  local scheduler_state
  local scheduler_flags=(
    --location "$REGION"
    --project "$PROJECT_ID"
    --schedule "$scheduler_cron"
    --time-zone "$scheduler_timezone"
    --uri "$RUN_JOB_URI"
    --http-method POST
    --message-body "$scheduler_body"
    --oauth-service-account-email "$SCHEDULER_SA"
    --attempt-deadline 180s
    --max-retry-attempts 1
    --min-backoff 60s
    --max-backoff 300s
  )

  scheduler_state="$(gcloud scheduler jobs describe "$scheduler_job" \
    --location "$REGION" --project "$PROJECT_ID" \
    --format='value(state)' 2>/dev/null || true)"
  if [[ -n "$scheduler_state" ]]; then
    log "scheduler '$scheduler_job' は既存（設定を更新: cron='${scheduler_cron}' tz=${scheduler_timezone}）"
    gcloud scheduler jobs update http "$scheduler_job" \
      "${scheduler_flags[@]}" \
      --update-headers Content-Type=application/json >/dev/null
  else
    log "scheduler '$scheduler_job' を作成（cron='${scheduler_cron}' tz=${scheduler_timezone}）"
    gcloud scheduler jobs create http "$scheduler_job" \
      "${scheduler_flags[@]}" \
      --headers Content-Type=application/json >/dev/null
    scheduler_state="ENABLED"
  fi

  if [[ "$scheduler_paused" == "1" && "$scheduler_state" != "PAUSED" ]]; then
    log "scheduler '$scheduler_job' を一時停止"
    gcloud scheduler jobs pause "$scheduler_job" \
      --location "$REGION" --project "$PROJECT_ID" >/dev/null
  elif [[ "$scheduler_paused" != "1" && "$scheduler_state" == "PAUSED" ]]; then
    log "scheduler '$scheduler_job' を再開"
    gcloud scheduler jobs resume "$scheduler_job" \
      --location "$REGION" --project "$PROJECT_ID" >/dev/null
  fi
}

ensure_scheduler \
  "$SCHEDULER_JOB" \
  "$SCHEDULER_CRON" \
  "$SCHEDULER_TIMEZONE" \
  "$SCHEDULER_PAUSED" \
  '{"overrides":{"containerOverrides":[{"args":["--mode=analyze-all"]}]}}'

ensure_scheduler \
  "$INGEST_SCHEDULER_JOB" \
  "$INGEST_SCHEDULER_CRON" \
  "$INGEST_SCHEDULER_TIMEZONE" \
  "$INGEST_SCHEDULER_PAUSED" \
  '{"overrides":{"containerOverrides":[{"args":["--mode=ingest","--target=frequent"]}]}}'

ensure_scheduler \
  "$INGEST_DAILY_SCHEDULER_JOB" \
  "$INGEST_DAILY_SCHEDULER_CRON" \
  "$INGEST_DAILY_SCHEDULER_TIMEZONE" \
  "$INGEST_DAILY_SCHEDULER_PAUSED" \
  '{"overrides":{"containerOverrides":[{"args":["--mode=maintain-bills"]}]}}'

# ── 9. Cloud Monitoring（取り込み失敗・定期実行の成功なし）──
# 取り込みモードごとの完了/失敗ログをカウンタ化する。Cloud Run Job は分析と共用のため、
# platform metric ではなくログ本文で取り込み実行だけを識別する。
if [[ "$MONITORING_ALERTS_ENABLED" == "1" ]]; then
  METRIC_ENV="$(printf '%s' "$DEPLOY_ENV" | tr -c '[:alnum:]_' '_')"
  INGEST_SCHEDULER_FAILURE_METRIC="numazu_ingest_scheduler_failure_${METRIC_ENV}"
  INGEST_FREQUENT_SUCCESS_METRIC="numazu_ingest_frequent_success_${METRIC_ENV}"
  INGEST_DAILY_SUCCESS_METRIC="numazu_ingest_daily_success_${METRIC_ENV}"

  ensure_log_metric() {
    local metric_name="$1"
    local description="$2"
    local log_filter="$3"
    if gcloud logging metrics describe "$metric_name" \
      --project "$PROJECT_ID" >/dev/null 2>&1; then
      log "logs-based metric '$metric_name' を更新"
      gcloud logging metrics update "$metric_name" \
        --project "$PROJECT_ID" \
        --description "$description" \
        --log-filter "$log_filter" >/dev/null
    else
      log "logs-based metric '$metric_name' を作成"
      gcloud logging metrics create "$metric_name" \
        --project "$PROJECT_ID" \
        --description "$description" \
        --log-filter "$log_filter" >/dev/null
    fi
  }

  ensure_log_metric \
    "$INGEST_SCHEDULER_FAILURE_METRIC" \
    "Failed Numazu council ingestion scheduler attempts (${DEPLOY_ENV})" \
    "resource.type=\"cloud_scheduler_job\" AND (resource.labels.job_id=\"${INGEST_SCHEDULER_JOB}\" OR resource.labels.job_id=\"${INGEST_DAILY_SCHEDULER_JOB}\") AND severity>=ERROR"
  ensure_log_metric \
    "$INGEST_FREQUENT_SUCCESS_METRIC" \
    "Successful frequent Numazu council ingestion runs (${DEPLOY_ENV})" \
    "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${JOB}\" AND textPayload:\"取り込み完了 (frequent):\""
  ensure_log_metric \
    "$INGEST_DAILY_SUCCESS_METRIC" \
    "Successful daily Numazu council ingestion runs (${DEPLOY_ENV})" \
    "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${JOB}\" AND textPayload:\"取り込み完了 (daily):\""

  ensure_alert_policy() {
    local display_name="$1"
    local condition_name="$2"
    local condition_filter="$3"
    local condition_if="$4"
    local duration="$5"
    local documentation="$6"
    local existing
    local existing_condition_kind=""
    local existing_condition_name=""
    local existing_policy_json
    local policy_json
    local desired_condition_kind="threshold"
    if [[ "$condition_if" == "absent" || "$condition_if" == "promql_absent" ]]; then
      desired_condition_kind="$condition_if"
    fi
    existing="$(gcloud monitoring policies list \
      --project "$PROJECT_ID" \
      --filter="displayName=\"${display_name}\"" \
      --format='value(name)' --limit=1)"
    if [[ -n "$existing" ]]; then
      existing_policy_json="$(gcloud monitoring policies describe "$existing" \
        --project "$PROJECT_ID" --format=json)"
      existing_condition_name="$(jq -r '.conditions[0].name // ""' \
        <<<"$existing_policy_json")"
      existing_condition_kind="$(jq -r '
        .conditions[0]
        | if has("conditionAbsent") then "absent"
          elif has("conditionPrometheusQueryLanguage") then "promql_absent"
          elif has("conditionThreshold") then "threshold"
          else ""
          end
        ' <<<"$existing_policy_json")"
      if [[ "$existing_condition_kind" != "$desired_condition_kind" ]]; then
        # condition種別の変更時は既存IDを再利用せず、新しいconditionとして置換する。
        existing_condition_name=""
      fi
    fi

    policy_json="$(jq -cn \
      --arg display_name "$display_name" \
      --arg condition_name "$condition_name" \
      --arg condition_resource_name "$existing_condition_name" \
      --arg condition_filter "$condition_filter" \
      --arg condition_if "$condition_if" \
      --arg duration "$duration" \
      --arg documentation "$documentation" \
      --arg notification_channels "$MONITORING_NOTIFICATION_CHANNELS" '
        {
          displayName: $display_name,
          combiner: "OR",
          enabled: true,
          documentation: {
            content: $documentation,
            mimeType: "text/markdown"
          },
          notificationChannels: (
            $notification_channels
            | split(",")
            | map(select(length > 0))
          ),
          conditions: [
            ({ displayName: $condition_name }
              + if $condition_resource_name == "" then {}
                else { name: $condition_resource_name }
                end
              + if $condition_if == "promql_absent" then {
                  conditionPrometheusQueryLanguage: {
                    query: $condition_filter,
                    duration: "0s",
                    evaluationInterval: "300s",
                    ruleGroup: "numazu-ingest",
                    alertRule: "daily_success_absence"
                  }
                } elif $condition_if == "absent" then {
                  conditionAbsent: {
                    filter: $condition_filter,
                    duration: $duration,
                    trigger: { count: 1 }
                  }
                } else {
                  conditionThreshold: {
                    filter: $condition_filter,
                    comparison: "COMPARISON_GT",
                    thresholdValue: 0,
                    duration: $duration,
                    trigger: { count: 1 },
                    aggregations: [{
                      alignmentPeriod: "300s",
                      perSeriesAligner: "ALIGN_SUM"
                    }]
                  }
                } end)
          ]
        }
      ')"
    if [[ -n "$existing" ]]; then
      log "alert policy '$display_name' を更新"
      gcloud monitoring policies update "$existing" \
        --project "$PROJECT_ID" \
        --policy "$policy_json" >/dev/null
    else
      log "alert policy '$display_name' を作成"
      gcloud monitoring policies create \
        --project "$PROJECT_ID" \
        --policy "$policy_json" >/dev/null
    fi
  }

  ensure_alert_policy \
    "Numazu worker execution failed (${DEPLOY_ENV})" \
    "Cloud Run Job実行が失敗" \
    "metric.type=\"run.googleapis.com/job/completed_execution_count\" AND resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${JOB}\" AND metric.labels.result=\"failed\"" \
    "> 0" \
    "0s" \
    "コンテナ起動・環境変数・DB接続を含むCloud Run Jobの失敗を確認してください。"
  ensure_alert_policy \
    "Numazu ingest scheduler failed (${DEPLOY_ENV})" \
    "Cloud Schedulerからの起動が失敗" \
    "metric.type=\"logging.googleapis.com/user/${INGEST_SCHEDULER_FAILURE_METRIC}\" AND resource.type=\"cloud_scheduler_job\"" \
    "> 0" \
    "0s" \
    "Cloud Schedulerの認証、IAM、Cloud Run Admin APIへの起動要求を確認してください。"
  ensure_alert_policy \
    "Numazu frequent ingest has no success for 24h (${DEPLOY_ENV})" \
    "軽量取り込みの成功が24時間ない" \
    "metric.type=\"logging.googleapis.com/user/${INGEST_FREQUENT_SUCCESS_METRIC}\" AND resource.type=\"cloud_run_job\"" \
    "absent" \
    "84600s" \
    "会期・提出議案・議決結果の定期取り込みを確認してください。"
  ensure_alert_policy \
    "Numazu daily ingest has no success for 25h (${DEPLOY_ENV})" \
    "会議録取り込みの成功が25時間ない" \
    "absent_over_time({\"logging.googleapis.com/user/${INGEST_DAILY_SUCCESS_METRIC}\", monitored_resource=\"cloud_run_job\"}[25h])" \
    "promql_absent" \
    "0s" \
    "会議録・AmiVoiceの定期取り込みを確認してください。"
fi

# ── 10. deployer SA（CI がイメージ push + Job 更新 + production secret 同期）──
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
  --location "$REGION" --project "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/artifactregistry.writer" >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/run.developer" \
  --condition=None >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --project "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/iam.serviceAccountUser" >/dev/null
for s in "SUPABASE_URL${SECRET_SUFFIX}" "SUPABASE_SECRET_KEY${SECRET_SUFFIX}"; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${DEPLOYER_SA}" \
    --role="roles/secretmanager.secretVersionManager" \
    --project "$PROJECT_ID" >/dev/null
done
log "deployer SA に image・Job更新、actAs、Supabase secret version管理権限（値の読み取り不可）を付与"

# ── 11. SA キー発行（任意・GENERATE_KEYS=1 のときのみ。鍵はコミットしない＝gitignore 済み） ──
if [[ "$GENERATE_KEYS" == "1" ]]; then
  log "SA キーを発行（invoker-key.json / deployer-key.json）"
  gcloud iam service-accounts keys create "${REPO_ROOT}/invoker-key.json" \
    --iam-account="$INVOKER_SA" --project "$PROJECT_ID"
  gcloud iam service-accounts keys create "${REPO_ROOT}/deployer-key.json" \
    --iam-account="$DEPLOYER_SA" --project "$PROJECT_ID"
  echo "  ⚠ invoker-key.json → Vercel(admin) の GCP_SA_KEY、deployer-key.json → GitHub Secrets の GCP_SA_KEY"
  echo "    に登録したら、ローカルの鍵ファイルを削除してください（rm -f invoker-key.json deployer-key.json）。"
else
  echo "  ℹ SA キーは発行していません（GENERATE_KEYS=1 で発行可）。"
fi

log "プロビジョニング完了"
