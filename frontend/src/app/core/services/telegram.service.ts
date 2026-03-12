import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TelegramStatus {
  is_linked: boolean;
  username: string | null;
  is_active: boolean;
  telegram_notifications_enabled: boolean;
  linked_at: string | null;
}

export interface TelegramLinkResponse {
  code: string;
  deep_link: string;
  expires_at: string;
  bot_username: string;
}

@Injectable({ providedIn: 'root' })
export class TelegramService {
  private readonly baseUrl = `${environment.apiUrl}/telegram`;

  constructor(private http: HttpClient) {}

  getStatus(): Observable<TelegramStatus> {
    return this.http.get<TelegramStatus>(`${this.baseUrl}/status/`);
  }

  generateLink(): Observable<TelegramLinkResponse> {
    return this.http.post<TelegramLinkResponse>(`${this.baseUrl}/link/`, {});
  }

  unlink(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/unlink/`, {});
  }

  toggleNotifications(enabled: boolean): Observable<{ telegram_notifications_enabled: boolean }> {
    return this.http.patch<{ telegram_notifications_enabled: boolean }>(
      `${this.baseUrl}/notifications/`,
      { enabled },
    );
  }
}
