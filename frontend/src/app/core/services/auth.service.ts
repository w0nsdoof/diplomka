import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface TokenResponse {
  access: string;
}

export interface UserInfo {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'superadmin' | 'manager' | 'engineer' | 'client';
  organization_id: number | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly USER_KEY = 'user_info';

  private accessToken: string | null = null;
  private currentUserSubject = new BehaviorSubject<UserInfo | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  login(email: string, password: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(
      `${environment.apiUrl}/auth/token/`,
      { email, password },
      { withCredentials: true },
    ).pipe(
      tap((res) => {
        this.accessToken = res.access;
        this.decodeAndStoreUser(res.access);
      }),
    );
  }

  refreshToken(): Observable<{ access: string }> {
    return this.http.post<{ access: string }>(
      `${environment.apiUrl}/auth/token/refresh/`,
      {},
      { withCredentials: true },
    ).pipe(
      tap((res) => {
        this.accessToken = res.access;
        this.decodeAndStoreUser(res.access);
      }),
    );
  }

  /**
   * Try to restore session from refresh cookie on app init.
   * Returns true if session was restored, false otherwise.
   */
  tryRestoreSession(): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.refreshToken().pipe(
        catchError(() => {
          observer.next(false);
          observer.complete();
          return of(null);
        }),
      ).subscribe((res) => {
        if (res) {
          observer.next(true);
          observer.complete();
        }
      });
    });
  }

  logout(): void {
    this.http.post(
      `${environment.apiUrl}/auth/logout/`,
      {},
      { withCredentials: true },
    ).subscribe();
    this.accessToken = null;
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isLoggedIn(): boolean {
    return !!this.accessToken;
  }

  getCurrentUser(): UserInfo | null {
    return this.currentUserSubject.value;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  isSuperadmin(): boolean {
    return this.hasRole('superadmin');
  }

  private decodeAndStoreUser(token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const user: UserInfo = {
        id: payload.user_id,
        email: payload.email || '',
        first_name: payload.first_name || '',
        last_name: payload.last_name || '',
        role: payload.role || 'engineer',
        organization_id: payload.organization_id ?? null,
      };
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.currentUserSubject.next(user);
    } catch {
      // Token decode failed
    }
  }

  private getStoredUser(): UserInfo | null {
    const stored = localStorage.getItem(this.USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
}
