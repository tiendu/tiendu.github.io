export const TOPIC_DETAILS = {
  "Reliability & Operations": {
    description:
      "Production reliability, incident response, observability, recovery, operational safety, and the engineering practices that make failures understandable.",
    order: 1,
  },
  "Infrastructure & Automation": {
    description:
      "Linux, containers, Git, shell tooling, build automation, HPC, distributed infrastructure, and practical tools for operating engineering systems.",
    order: 2,
  },
  "Software Engineering": {
    description:
      "Programming languages, API design, algorithms, architecture, maintainability, and techniques for building software that survives real use.",
    order: 3,
  },
  "Bioinformatics Engineering": {
    description:
      "Scientific data platforms, reproducible workflows, public datasets, sequence search, functional annotation, and engineering for biological computation.",
    order: 4,
  },
  "Statistics & Machine Learning": {
    description:
      "Practical statistics, uncertainty, classical machine learning, model behavior, and explanations that connect mathematical ideas to real analysis.",
    order: 5,
  },
  "Essays & Career": {
    description:
      "Personal essays about engineering work, career choices, ambition, meaning, ordinary life, and the quiet questions surrounding professional identity.",
    order: 6,
  },
} as const;

export type PostTopic = keyof typeof TOPIC_DETAILS;

export function getTopicDescription(topic: string): string {
  return topic in TOPIC_DETAILS
    ? TOPIC_DETAILS[topic as PostTopic].description
    : `Notes filed under ${topic}.`;
}

export function getTopicOrder(topic: string): number {
  return topic in TOPIC_DETAILS
    ? TOPIC_DETAILS[topic as PostTopic].order
    : Number.MAX_SAFE_INTEGER;
}
