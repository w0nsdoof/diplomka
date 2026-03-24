import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TaskListItem {
  id: number;
  title: string;
  status: string;
  priority: string;
  deadline: string;
  created_at: string;
  updated_at: string;
  client: { id: number; name: string } | null;
  assignees: { id: number; first_name: string; last_name: string }[];
  tags: { id: number; name: string; slug: string; color: string }[];
  comments_count: number;
  attachments_count: number;
  entity_type: string;
  epic: { id: number; title: string } | null;
  parent_task: { id: number; title: string } | null;
  subtasks_count: number;
}

export interface TaskDetailSubtask {
  id: number;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  assignees: { id: number; first_name: string; last_name: string }[];
}

export interface TaskDetail extends TaskListItem {
  description: string;
  created_by: { id: number; first_name: string; last_name: string };
  comments: any[];
  attachments: any[];
  history: any[];
  version: number;
  epic: { id: number; title: string; project?: { id: number; title: string } | null } | null;
  subtasks: TaskDetailSubtask[];
}

export interface TaskCreatePayload {
  title: string;
  description?: string;
  priority?: string;
  deadline?: string;
  client_id?: number | null;
  assignee_ids?: number[];
  tag_ids?: number[];
  epic_id?: number | null;
  parent_task_id?: number | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TaskFilters {
  page?: number;
  page_size?: number;
  status?: string;
  priority?: string;
  deadline_from?: string;
  deadline_to?: string;
  assignee?: number;
  client?: number;
  tags?: string;
  search?: string;
  ordering?: string;
  parent_task?: number;
  epic?: number;
  entity_type?: string;
  include_subtasks?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly baseUrl = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  list(filters: TaskFilters = {}): Observable<PaginatedResponse<TaskListItem>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<PaginatedResponse<TaskListItem>>(`${this.baseUrl}/`, { params });
  }

  get(id: number): Observable<TaskDetail> {
    return this.http.get<TaskDetail>(`${this.baseUrl}/${id}/`);
  }

  create(payload: TaskCreatePayload): Observable<TaskDetail> {
    return this.http.post<TaskDetail>(`${this.baseUrl}/`, payload);
  }

  update(id: number, payload: Partial<TaskCreatePayload>): Observable<TaskDetail> {
    return this.http.patch<TaskDetail>(`${this.baseUrl}/${id}/`, payload);
  }

  changeStatus(id: number, status: string, comment?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/status/`, { status, comment });
  }

  assign(id: number, assigneeIds: number[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/assign/`, { assignee_ids: assigneeIds });
  }

  getHistory(id: number, page = 1): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/${id}/history/`, {
      params: { page: String(page) },
    });
  }

  getAttachments(id: number): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/${id}/attachments/`);
  }

  uploadAttachment(id: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.baseUrl}/${id}/attachments/`, formData);
  }

  downloadAttachment(taskId: number, attachmentId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${taskId}/attachments/${attachmentId}/`, {
      responseType: 'blob',
    });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/`);
  }

  deleteAttachment(taskId: number, attachmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${taskId}/attachments/${attachmentId}/`);
  }

  getSubtasks(taskId: number, page = 1): Observable<PaginatedResponse<TaskListItem>> {
    return this.http.get<PaginatedResponse<TaskListItem>>(`${this.baseUrl}/${taskId}/subtasks/`, {
      params: { page: String(page) },
    });
  }
}
