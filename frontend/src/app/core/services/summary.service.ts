import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SummaryListItem {
  id: number;
  period_type: 'daily' | 'weekly' | 'on_demand';
  period_start: string;
  period_end: string;
  summary_text: string;
  generation_method: 'ai' | 'fallback' | '';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  generated_at: string;
  has_versions: boolean;
}

export interface SummaryDetail extends SummaryListItem {
  llm_model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  generation_time_ms: number | null;
  raw_data: any;
  error_message: string;
  requested_by: { id: number; email: string; first_name: string; last_name: string } | null;
  version_count: number;
}

export interface SummaryVersion {
  id: number;
  summary_text: string;
  generation_method: 'ai' | 'fallback';
  status: string;
  generated_at: string;
  requested_by: { id: number; email: string; first_name: string; last_name: string } | null;
}

export interface LatestSummaries {
  daily: SummaryListItem | null;
  weekly: SummaryListItem | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class SummaryService {
  private readonly baseUrl = `${environment.apiUrl}/summaries`;

  constructor(private http: HttpClient) {}

  getLatest(): Observable<LatestSummaries> {
    return this.http.get<LatestSummaries>(`${this.baseUrl}/latest/`);
  }

  list(filters: { period_type?: string; status?: string; page?: number } = {}): Observable<PaginatedResponse<SummaryListItem>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<PaginatedResponse<SummaryListItem>>(`${this.baseUrl}/`, { params });
  }

  getById(id: number): Observable<SummaryDetail> {
    return this.http.get<SummaryDetail>(`${this.baseUrl}/${id}/`);
  }

  getVersions(id: number): Observable<SummaryVersion[]> {
    return this.http.get<SummaryVersion[]>(`${this.baseUrl}/${id}/versions/`);
  }

  generate(periodStart: string, periodEnd: string): Observable<SummaryDetail> {
    return this.http.post<SummaryDetail>(`${this.baseUrl}/generate/`, {
      period_start: periodStart,
      period_end: periodEnd,
    });
  }

  regenerate(id: number): Observable<SummaryDetail> {
    return this.http.post<SummaryDetail>(`${this.baseUrl}/${id}/regenerate/`, {});
  }
}
