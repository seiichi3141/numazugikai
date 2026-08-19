import { CouncilSessionItem } from "../../client/components/council-session-item";
import type { CouncilSession } from "../../shared/types";

type CouncilSessionListProps = {
  sessions: CouncilSession[];
};

export function CouncilSessionList({ sessions }: CouncilSessionListProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        国会会期一覧 ({sessions.length}件)
      </h2>

      {sessions.length === 0 ? (
        <p className="text-gray-500">国会会期がありません</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <CouncilSessionItem key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
