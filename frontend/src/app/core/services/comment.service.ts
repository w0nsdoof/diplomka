import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CommentAuthor {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
}

export interface Comment {
  id: number;
  author: CommentAuthor;
  content: string;
  is_public: boolean;
  mentions: { id: number; first_name: string; last_name: string }[];
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class CommentService {
  constructor(private http: HttpClient) {}

  list(taskId: number, page = 1): Observable<PaginatedResponse<Comment>> {
    const params = new HttpParams().set('page', String(page));
    return this.http.get<PaginatedResponse<Comment>>(
      `${environment.apiUrl}/tasks/${taskId}/comments/`,
      { params },
    );
  }

  create(taskId: number, content: string, isPublic = true): Observable<Comment> {
    return this.http.post<Comment>(`${environment.apiUrl}/tasks/${taskId}/comments/`, {
      content,
      is_public: isPublic,
    });
  }
}
