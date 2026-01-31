import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class TagService {
  private readonly baseUrl = `${environment.apiUrl}/tags`;

  constructor(private http: HttpClient) {}

  list(search?: string): Observable<PaginatedResponse<Tag>> {
    let params = new HttpParams().set('page_size', '100');
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PaginatedResponse<Tag>>(`${this.baseUrl}/`, { params });
  }

  create(name: string, color?: string): Observable<Tag> {
    const payload: any = { name };
    if (color) payload.color = color;
    return this.http.post<Tag>(`${this.baseUrl}/`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/`);
  }
}
