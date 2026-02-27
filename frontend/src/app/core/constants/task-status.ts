export const STATUS_TRANSLATION_KEYS: Record<string, string> = {
  created: 'statuses.created',
  in_progress: 'statuses.in_progress',
  waiting: 'statuses.waiting',
  done: 'statuses.done',
  archived: 'statuses.archived',
};

export const VALID_TRANSITIONS: Record<string, string[]> = {
  created: ['in_progress'],
  in_progress: ['waiting', 'done'],
  waiting: ['in_progress'],
  done: ['in_progress', 'archived'],
};
