import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  task_id: number | null;
  summary_id: number | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly baseUrl = `${environment.apiUrl}/notifications`;
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  list(isRead?: boolean, page = 1): Observable<PaginatedResponse<Notification>> {
    let params = new HttpParams().set('page', String(page));
    if (isRead !== undefined) {
      params = params.set('is_read', String(isRead));
    }
    return this.http.get<PaginatedResponse<Notification>>(`${this.baseUrl}/`, { params });
  }

  markAsRead(id: number): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}/read/`, {}).pipe(
      tap(() => {
        const current = this.unreadCountSubject.value;
        if (current > 0) this.unreadCountSubject.next(current - 1);
      }),
    );
  }

  markAllAsRead(): Observable<{ updated_count: number }> {
    return this.http.post<{ updated_count: number }>(`${this.baseUrl}/read-all/`, {}).pipe(
      tap(() => this.unreadCountSubject.next(0)),
    );
  }

  refreshUnreadCount(): void {
    this.list(false).subscribe((res) => {
      this.unreadCountSubject.next(res.count);
    });
  }
}
