import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ProjectListItem,
  ProjectDetail,
  ProjectCreatePayload,
  ProjectUpdatePayload,
  EpicListItem,
  EpicDetail,
  EpicCreatePayload,
  EpicUpdatePayload,
  PaginatedResponse,
  GeneratedTask,
  GenerationStatus,
  ConfirmTasksResponse,
} from '../models/hierarchy.models';

export interface ProjectFilters {
  page?: number;
  page_size?: number;
  status?: string;
  priority?: string;
  search?: string;
  ordering?: string;
  assignee?: number;
  client?: number;
  tags?: string;
}

export interface EpicFilters {
  page?: number;
  page_size?: number;
  status?: string;
  priority?: string;
  search?: string;
  ordering?: string;
  project?: number;
  assignee?: number;
  client?: number;
  tags?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly projectsUrl = `${environment.apiUrl}/projects`;
  private readonly epicsUrl = `${environment.apiUrl}/epics`;

  constructor(private http: HttpClient) {}

  // ── Project methods ──────────────────────────────────────────────

  listProjects(filters: ProjectFilters = {}): Observable<PaginatedResponse<ProjectListItem>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<PaginatedResponse<ProjectListItem>>(`${this.projectsUrl}/`, { params });
  }

  getProject(id: number): Observable<ProjectDetail> {
    return this.http.get<ProjectDetail>(`${this.projectsUrl}/${id}/`);
  }

  createProject(payload: ProjectCreatePayload): Observable<ProjectDetail> {
    return this.http.post<ProjectDetail>(`${this.projectsUrl}/`, payload);
  }

  updateProject(id: number, payload: ProjectUpdatePayload): Observable<ProjectDetail> {
    return this.http.patch<ProjectDetail>(`${this.projectsUrl}/${id}/`, payload);
  }

  changeProjectStatus(id: number, status: string): Observable<any> {
    return this.http.post(`${this.projectsUrl}/${id}/status/`, { status });
  }

  getProjectEpics(id: number, page = 1): Observable<PaginatedResponse<EpicListItem>> {
    return this.http.get<PaginatedResponse<EpicListItem>>(`${this.projectsUrl}/${id}/epics/`, {
      params: { page: String(page) },
    });
  }

  getProjectHistory(id: number, page = 1): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`${this.projectsUrl}/${id}/history/`, {
      params: { page: String(page) },
    });
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.projectsUrl}/${id}/`);
  }

  // ── Epic methods ─────────────────────────────────────────────────

  listEpics(filters: EpicFilters = {}): Observable<PaginatedResponse<EpicListItem>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<PaginatedResponse<EpicListItem>>(`${this.epicsUrl}/`, { params });
  }

  getEpic(id: number): Observable<EpicDetail> {
    return this.http.get<EpicDetail>(`${this.epicsUrl}/${id}/`);
  }

  createEpic(payload: EpicCreatePayload): Observable<EpicDetail> {
    return this.http.post<EpicDetail>(`${this.epicsUrl}/`, payload);
  }

  updateEpic(id: number, payload: EpicUpdatePayload): Observable<EpicDetail> {
    return this.http.patch<EpicDetail>(`${this.epicsUrl}/${id}/`, payload);
  }

  changeEpicStatus(id: number, status: string): Observable<any> {
    return this.http.post(`${this.epicsUrl}/${id}/status/`, { status });
  }

  getEpicTasks(id: number, page = 1): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`${this.epicsUrl}/${id}/tasks/`, {
      params: { page: String(page) },
    });
  }

  getEpicHistory(id: number, page = 1): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`${this.epicsUrl}/${id}/history/`, {
      params: { page: String(page) },
    });
  }

  deleteEpic(id: number): Observable<void> {
    return this.http.delete<void>(`${this.epicsUrl}/${id}/`);
  }

  // ── AI Task Generation ────────────────────────────────────────────

  generateEpicTasks(epicId: number, llmModelId?: number | null): Observable<{ task_id: string }> {
    const body: Record<string, unknown> = {};
    if (llmModelId) body['llm_model_id'] = llmModelId;
    return this.http.post<{ task_id: string }>(`${this.epicsUrl}/${epicId}/generate-tasks/`, body);
  }

  pollGenerationStatus(epicId: number, taskId: string): Observable<GenerationStatus> {
    return this.http.get<GenerationStatus>(`${this.epicsUrl}/${epicId}/generate-tasks/status/`, {
      params: { task_id: taskId },
    });
  }

  confirmEpicTasks(epicId: number, tasks: GeneratedTask[]): Observable<ConfirmTasksResponse> {
    return this.http.post<ConfirmTasksResponse>(`${this.epicsUrl}/${epicId}/confirm-tasks/`, { tasks });
  }
}
