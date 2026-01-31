import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Client {
  id: number;
  name: string;
  client_type: string;
  phone: string;
  email: string;
  contact_person: string;
  created_at: string;
  tasks_count?: number;
  task_summary?: {
    total: number;
    created: number;
    in_progress: number;
    waiting: number;
    done: number;
    archived: number;
  };
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly baseUrl = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  list(params: { page?: number; search?: string; ordering?: string } = {}): Observable<PaginatedResponse<Client>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<PaginatedResponse<Client>>(`${this.baseUrl}/`, { params: httpParams });
  }

  get(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.baseUrl}/${id}/`);
  }

  create(payload: Partial<Client>): Observable<Client> {
    return this.http.post<Client>(`${this.baseUrl}/`, payload);
  }

  update(id: number, payload: Partial<Client>): Observable<Client> {
    return this.http.patch<Client>(`${this.baseUrl}/${id}/`, payload);
  }

  getTasks(id: number, params: any = {}): Observable<PaginatedResponse<any>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams = httpParams.set(key, String(value as string));
      }
    });
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/${id}/tasks/`, { params: httpParams });
  }
}
