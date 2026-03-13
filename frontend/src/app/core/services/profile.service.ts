import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  avatar: string | null;
  job_title: string;
  skills: string;
  bio: string;
  date_joined: string;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  job_title?: string;
  skills?: string;
  bio?: string;
  password?: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly url = `${environment.apiUrl}/users/me/`;

  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.url);
  }

  updateProfile(data: UpdateProfilePayload): Observable<UserProfile> {
    return this.http.patch<UserProfile>(this.url, data);
  }

  uploadAvatar(file: File): Observable<UserProfile> {
    const fd = new FormData();
    fd.append('avatar', file);
    return this.http.patch<UserProfile>(this.url, fd);
  }

  removeAvatar(): Observable<UserProfile> {
    return this.http.patch<UserProfile>(this.url, { avatar: null });
  }
}
