export const STATUS_LABELS: Record<string, string> = {
  created: 'Created',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  done: 'Done',
  archived: 'Archived',
};

export const VALID_TRANSITIONS: Record<string, string[]> = {
  created: ['in_progress'],
  in_progress: ['waiting', 'done'],
  waiting: ['in_progress'],
  done: ['in_progress', 'archived'],
};
