import type { BillStatusEnum } from "../../../shared/types";
import {
  calculateProgressWidth,
  getCurrentStep,
  getStatusMessage,
  getStepState,
} from "../../../shared/utils/bill-progress";

interface BillStatusProgressProps {
  status: BillStatusEnum;
  statusNote?: string | null;
}

interface StatusBadgeProps {
  message: string;
}

interface ProgressStepProps {
  label: string;
  stepNumber: number;
  currentStep: number;
  isActive: boolean;
  isPreparing: boolean;
}

// 市議会は一院制。委員会審査を経て本会議で議決する流れを表す
const STEP_LABELS = [
  "議案\n提出",
  "委員会\n付託",
  "委員会\n審査",
  "本会議\n議決",
] as const;

// ステータスバッジコンポーネント
function StatusBadge({ message }: StatusBadgeProps) {
  if (!message) return null;

  return (
    <div className="w-full max-w-md relative">
      <div className="w-full text-center bg-mirai-gradient rounded-lg px-4 py-3.5">
        <span className="text-base font-medium text-foreground">{message}</span>
      </div>
      {/* 下向き三角形 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft: "7.5px solid transparent",
          borderRight: "7.5px solid transparent",
          borderTop: "7.5px solid var(--color-mirai-progress-fill)",
        }}
      />
    </div>
  );
}

// プログレスステップコンポーネント
function ProgressStep({
  label,
  stepNumber,
  currentStep,
  isActive,
  isPreparing,
}: ProgressStepProps) {
  const isCurrentStep = isActive && stepNumber === currentStep;

  return (
    <div className="flex flex-col items-center">
      {/* ドット */}
      <div
        className={`w-3 h-3 rounded-full border transition-all duration-300 ${
          isActive
            ? "bg-primary border-primary"
            : "bg-mirai-surface-muted border-mirai-border"
        }`}
      >
        {/* 現在のステップを強調 */}
        {isCurrentStep && (
          <div className="w-5 h-5 bg-primary rounded-full -mt-[5px] -ml-[5px]" />
        )}
      </div>

      {/* ラベル */}
      <div className="mt-2">
        <span
          className={`flex flex-col text-sm leading-6 whitespace-pre-line text-center ${
            isActive && !isPreparing
              ? "text-foreground"
              : "text-mirai-text-muted"
          } font-normal`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export function BillStatusProgress({
  status,
  statusNote,
}: BillStatusProgressProps) {
  const isPreparing = status === "preparing";
  const currentStep = getCurrentStep(status);
  const progressWidth = calculateProgressWidth(currentStep);

  const statusMessage = getStatusMessage(status, statusNote);

  return (
    <>
      <h2 className="text-[22px] font-bold mb-4">👉 審議のステータス</h2>
      <div className="bg-card rounded-lg border p-6">
        <div className="flex flex-col items-center gap-7">
          {/* ステータスメッセージバッジ */}
          <StatusBadge message={statusMessage} />

          {/* プログレスライン */}
          <div className="relative w-full max-w-md">
            {/* 背景ライン */}
            <div className="absolute top-[5.5px] left-0 w-full h-[1px] bg-mirai-surface-muted" />

            {/* アクティブライン */}
            {!isPreparing && currentStep > 0 && (
              <div
                className="absolute top-[5px] left-0 h-0.5 bg-primary transition-all duration-300"
                style={{ width: `${Math.min(progressWidth, 100)}%` }}
              />
            )}

            {/* ステップドット */}
            <div className="relative flex justify-around">
              {STEP_LABELS.map((label, index) => {
                const stepNumber = index + 1;
                const isActive =
                  getStepState(stepNumber, currentStep, isPreparing) ===
                  "active";

                return (
                  <ProgressStep
                    key={stepNumber}
                    label={label}
                    stepNumber={stepNumber}
                    currentStep={currentStep}
                    isActive={isActive}
                    isPreparing={isPreparing}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
