import type { GeneralQuestionSession } from "../types/general-question";

export type PolicyTopicSummary = {
  id: string;
  label: string;
  itemCount: number;
  appearanceCount: number;
  sessionNames: string[];
};

export type TopicRoleCooccurrence = {
  topicId: string;
  topicLabel: string;
  roleGroup: string;
  appearanceCount: number;
};

export function buildGeneralQuestionVisualization(
  sessions: readonly GeneralQuestionSession[]
): {
  topics: PolicyTopicSummary[];
  cooccurrences: TopicRoleCooccurrence[];
} {
  const topics = new Map<
    string,
    Pick<PolicyTopicSummary, "id" | "label" | "itemCount"> & {
      appearanceIds: Set<string>;
      sessions: Set<string>;
    }
  >();
  const cooccurrences = new Map<
    string,
    Omit<TopicRoleCooccurrence, "appearanceCount"> & {
      appearanceIds: Set<string>;
    }
  >();

  for (const session of sessions) {
    for (const appearance of session.appearances) {
      const appearanceTopics = new Map(
        appearance.items.flatMap((item) =>
          item.topics.map((topic) => [topic.id, topic] as const)
        )
      );
      const roleGroups = new Set(
        appearance.answerers
          .map((answerer) => answerer.roleGroup)
          .filter((roleGroup) => roleGroup !== "unknown")
      );
      for (const item of appearance.items) {
        if (item.parentItemId !== null) continue;
        for (const topic of item.topics) {
          const summary = topics.get(topic.id) ?? {
            id: topic.id,
            label: topic.label,
            itemCount: 0,
            appearanceIds: new Set<string>(),
            sessions: new Set<string>(),
          };
          summary.itemCount += 1;
          summary.appearanceIds.add(appearance.id);
          summary.sessions.add(session.name);
          topics.set(topic.id, summary);
        }
      }
      for (const topic of appearanceTopics.values()) {
        for (const roleGroup of roleGroups) {
          const key = `${topic.id}:${roleGroup}`;
          const cell = cooccurrences.get(key) ?? {
            topicId: topic.id,
            topicLabel: topic.label,
            roleGroup,
            appearanceIds: new Set<string>(),
          };
          cell.appearanceIds.add(appearance.id);
          cooccurrences.set(key, cell);
        }
      }
    }
  }

  return {
    topics: [...topics.values()]
      .map(({ appearanceIds, sessions, ...topic }) => ({
        ...topic,
        appearanceCount: appearanceIds.size,
        sessionNames: [...sessions],
      }))
      .sort(
        (a, b) => b.itemCount - a.itemCount || a.label.localeCompare(b.label)
      ),
    cooccurrences: [...cooccurrences.values()]
      .map(({ appearanceIds, ...cell }) => ({
        ...cell,
        appearanceCount: appearanceIds.size,
      }))
      .sort(
        (a, b) =>
          a.topicLabel.localeCompare(b.topicLabel) ||
          a.roleGroup.localeCompare(b.roleGroup)
      ),
  };
}
