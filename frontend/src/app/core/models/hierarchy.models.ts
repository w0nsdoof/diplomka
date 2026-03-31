export interface UserBrief {
  id: number;
  first_name: string;
  last_name: string;
}

export interface ClientBrief {
  id: number;
  name: string;
}

export interface TagBrief {
  id: number;
  name: string;
  color: string;
}

export interface ProjectListItem {
  id: number;
  title: string;
  status: string;
  priority: string | null;
  deadline: string | null;
  assignee: UserBrief | null;
  client: ClientBrief | null;
  tags: TagBrief[];
  epics_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends ProjectListItem {
  description: string;
  created_by: UserBrief;
  version: number;
}

export interface ProjectCreatePayload {
  title: string;
  description?: string;
  priority?: string;
  deadline?: string;
  assignee_id?: number | null;
  client_id?: number | null;
  tag_ids?: number[];
}

export interface ProjectUpdatePayload extends Partial<ProjectCreatePayload> {
  version: number;
}

export interface EpicListItem {
  id: number;
  title: string;
  status: string;
  priority: string | null;
  deadline: string | null;
  project: { id: number; title: string } | null;
  assignee: UserBrief | null;
  client: ClientBrief | null;
  tags: TagBrief[];
  tasks_count: number;
  created_at: string;
  updated_at: string;
}

export interface EpicDetail extends EpicListItem {
  description: string;
  created_by: UserBrief;
  version: number;
}

export interface EpicCreatePayload {
  title: string;
  description?: string;
  priority?: string;
  deadline?: string;
  project_id?: number | null;
  assignee_id?: number | null;
  client_id?: number | null;
  tag_ids?: number[];
}

export interface EpicUpdatePayload extends Partial<EpicCreatePayload> {
  version: number;
}

export interface SubtaskSummary {
  id: number;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  assignees: UserBrief[];
}

export interface ParentContext {
  parentType: 'project' | 'epic' | 'task';
  parentId: number;
  projectId?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
