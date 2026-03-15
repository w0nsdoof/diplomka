import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { HttpParams } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';

@Component({
    selector: 'app-user-management',
    imports: [
        CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
        MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
        MatCardModule, MatChipsModule, MatSlideToggleModule, SearchBarComponent, TranslateModule,
    ],
    template: `
    <div class="page-header">
      <div>
        <h2>{{ 'users.allUsers' | translate }}</h2>
        <p class="page-subtitle">{{ 'admin.title' | translate }}</p>
      </div>
      <button class="flat-btn-primary" (click)="showCreateForm = !showCreateForm">
        <mat-icon>person_add</mat-icon> {{ 'users.addUser' | translate }}
      </button>
    </div>

    <!-- Create form overlay -->
    <div *ngIf="showCreateForm" class="create-overlay">
      <div class="create-dialog flat-card">
        <div class="dialog-header">
          <h3>{{ 'admin.createUser' | translate }}</h3>
          <button class="close-btn" (click)="showCreateForm = false"><mat-icon>close</mat-icon></button>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="flat-input-label">{{ 'common.email' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newUser.email" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'admin.firstName' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newUser.first_name" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'admin.lastName' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newUser.last_name" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'admin.role' | translate }}</label>
            <mat-form-field appearance="outline" class="full-width">
              <mat-select [(ngModel)]="newUser.role">
                <mat-option value="manager">{{ 'admin.manager' | translate }}</mat-option>
                <mat-option value="engineer">{{ 'admin.engineer' | translate }}</mat-option>
                <mat-option value="client">{{ 'admin.client' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'auth.password' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newUser.password" type="password" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'users.phoneNumber' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newUser.phone" />
          </div>
        </div>
        <div class="dialog-actions">
          <button class="flat-btn-outline" (click)="showCreateForm = false">{{ 'common.cancel' | translate }}</button>
          <button class="flat-btn-primary" (click)="createUser()">{{ 'common.create' | translate }}</button>
        </div>
      </div>
    </div>

    <app-search-bar [placeholder]="'admin.searchUsers' | translate" (search)="onSearch($event)"></app-search-bar>

    <table mat-table [dataSource]="users" class="full-width">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>{{ 'users.fullName' | translate }}</th>
        <td mat-cell *matCellDef="let u">
          <div class="user-cell">
            <span class="user-cell-avatar">{{ u.first_name?.charAt(0) || '' }}</span>
            {{ u.first_name }} {{ u.last_name }}
          </div>
        </td>
      </ng-container>
      <ng-container matColumnDef="email">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.email' | translate }}</th>
        <td mat-cell *matCellDef="let u">{{ u.email }}</td>
      </ng-container>
      <ng-container matColumnDef="role">
        <th mat-header-cell *matHeaderCellDef>{{ 'admin.role' | translate }}</th>
        <td mat-cell *matCellDef="let u">
          <span [class]="'role-chip-' + u.role">{{ u.role }}</span>
        </td>
      </ng-container>
      <ng-container matColumnDef="phone">
        <th mat-header-cell *matHeaderCellDef>{{ 'users.phoneNumber' | translate }}</th>
        <td mat-cell *matCellDef="let u">{{ u.phone || '-' }}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | translate }}</th>
        <td mat-cell *matCellDef="let u">
          <div class="action-cell">
            <mat-slide-toggle [checked]="u.is_active"
                              (change)="toggleUserActive(u)"
                              color="primary">
            </mat-slide-toggle>
            <button class="delete-btn" (click)="deactivateUser(u.id)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>

    <div class="pagination-info" *ngIf="users.length">
      {{ 'common.showing' | translate }} 1-{{ users.length }} {{ 'common.of' | translate }} {{ users.length }}
    </div>
  `,
    styles: [`
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px;
    }
    .page-header h2 { font-size: 22px; font-weight: 700; margin: 0; }
    .page-subtitle { font-size: 14px; color: var(--text-secondary, #6b7280); margin: 4px 0 0 0; }
    .full-width { width: 100%; }

    .create-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.3); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
    }
    .create-dialog {
      width: 560px; max-height: 90vh; overflow-y: auto;
    }
    .dialog-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px;
    }
    .dialog-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
    .close-btn {
      background: none; border: none; cursor: pointer;
      color: #9ca3af; padding: 4px; border-radius: 4px;
    }
    .close-btn:hover { background: #f3f4f6; }
    .form-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
      margin-bottom: 20px;
    }
    .form-group { display: flex; flex-direction: column; }
    .dialog-actions { display: flex; gap: 12px; justify-content: flex-end; }

    .user-cell { display: flex; align-items: center; gap: 8px; }
    .user-cell-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: #e5e7eb; color: #6b7280;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 600; flex-shrink: 0;
    }

    .action-cell { display: flex; align-items: center; gap: 8px; }
    .delete-btn {
      background: none; border: none; cursor: pointer;
      color: #ef4444; padding: 4px; border-radius: 4px;
    }
    .delete-btn:hover { background: #fef2f2; }

    .pagination-info {
      padding: 12px 0; font-size: 13px; color: var(--text-secondary, #6b7280);
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManagementComponent implements OnInit, OnDestroy {
  users: any[] = [];
  columns = ['name', 'email', 'role', 'phone', 'actions'];
  showCreateForm = false;
  newUser = { email: '', first_name: '', last_name: '', role: 'engineer', password: '', phone: '' };
  private searchTerm = '';
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.loadUsers(); }

  loadUsers(): void {
    let params = new HttpParams();
    if (this.searchTerm) {
      params = params.set('search', this.searchTerm);
    }
    this.http.get<any>(`${environment.apiUrl}/users/`, { params }).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.users = res.results;
      this.cdr.markForCheck();
    });
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.loadUsers();
  }

  createUser(): void {
    this.http.post(`${environment.apiUrl}/users/`, this.newUser).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showCreateForm = false;
      this.newUser = { email: '', first_name: '', last_name: '', role: 'engineer', password: '', phone: '' };
      this.loadUsers();
      this.cdr.markForCheck();
    });
  }

  toggleUserActive(user: any): void {
    if (user.is_active) {
      this.deactivateUser(user.id);
    }
  }

  deactivateUser(id: number): void {
    this.http.delete(`${environment.apiUrl}/users/${id}/`).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadUsers();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
