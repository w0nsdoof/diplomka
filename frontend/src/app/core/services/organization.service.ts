import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  user_count: number;
  task_count: number;
  created_at: string;
}

export interface OrganizationDetail extends Organization {
  manager_count: number;
  engineer_count: number;
  client_user_count: number;
  client_count: number;
  updated_at: string;
}

export interface ManagerBrief {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly baseUrl = `${environment.apiUrl}/platform/organizations`;

  constructor(private http: HttpClient) {}

  list(params?: { search?: string; is_active?: boolean; page?: number }): Observable<PaginatedResponse<Organization>> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.is_active !== undefined) httpParams = httpParams.set('is_active', String(params.is_active));
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    return this.http.get<PaginatedResponse<Organization>>(`${this.baseUrl}/`, { params: httpParams });
  }

  get(id: number): Observable<OrganizationDetail> {
    return this.http.get<OrganizationDetail>(`${this.baseUrl}/${id}/`);
  }

  create(data: { name: string }): Observable<OrganizationDetail> {
    return this.http.post<OrganizationDetail>(`${this.baseUrl}/`, data);
  }

  update(id: number, data: { name?: string; is_active?: boolean }): Observable<OrganizationDetail> {
    return this.http.patch<OrganizationDetail>(`${this.baseUrl}/${id}/`, data);
  }

  listManagers(orgId: number): Observable<{ count: number; results: ManagerBrief[] }> {
    return this.http.get<{ count: number; results: ManagerBrief[] }>(`${this.baseUrl}/${orgId}/managers/`);
  }

  createManager(orgId: number, data: { email: string; first_name: string; last_name: string; password: string }): Observable<ManagerBrief> {
    return this.http.post<ManagerBrief>(`${this.baseUrl}/${orgId}/managers/`, data);
  }
}
