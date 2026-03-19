import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ClientService, Client, ClientEmployee } from '../../../../core/services/client.service';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

@Component({
    selector: 'app-client-detail',
    imports: [
        CommonModule, RouterModule, FormsModule, MatCardModule, MatButtonModule,
        MatIconModule, MatTableModule, MatFormFieldModule, MatInputModule, TranslateModule,
    ],
    template: `
    <div *ngIf="client" class="client-detail">
      <div class="page-header">
        <h2>{{ client.name }}</h2>
        <a class="flat-btn-primary" [routerLink]="['/clients', client.id, 'edit']">
          <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
        </a>
      </div>

      <div class="detail-card flat-card">
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">{{ 'clients.type' | translate }}</span>
            <span class="detail-value">
              <span class="type-badge" [class]="'type-' + client.client_type">{{ client.client_type }}</span>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ 'common.email' | translate }}</span>
            <span class="detail-value">{{ client.email || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ 'common.phone' | translate }}</span>
            <span class="detail-value">{{ client.phone || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ 'clients.contactPerson' | translate }}</span>
            <span class="detail-value">{{ client.contact_person || '-' }}</span>
          </div>
        </div>
      </div>

      <h3 *ngIf="client.task_summary" class="summary-title">{{ 'clients.taskSummary' | translate }}</h3>
      <div *ngIf="client.task_summary" class="stats-grid">
        <div *ngFor="let item of summaryItems" class="stat-card">
          <div class="stat-value">{{ item.value }}</div>
          <div class="stat-label">{{ item.labelKey | translate }}</div>
        </div>
      </div>

      <!-- Employees section -->
      <div class="section-header">
        <h3 class="summary-title">
          {{ 'clients.employees' | translate }}
          <span class="count-badge" *ngIf="client.employee_count">{{ client.employee_count }}</span>
        </h3>
        <button *ngIf="isManager" class="flat-btn-primary btn-sm" (click)="showAddEmployee = true">
          <mat-icon>person_add</mat-icon> {{ 'clients.addEmployee' | translate }}
        </button>
      </div>

      <table mat-table [dataSource]="client.employees || []" class="full-width" *ngIf="client.employees?.length">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>{{ 'users.fullName' | translate }}</th>
          <td mat-cell *matCellDef="let e">
            <div class="user-cell">
              <span class="user-cell-avatar">{{ e.first_name?.charAt(0) || '' }}</span>
              {{ e.first_name }} {{ e.last_name }}
            </div>
          </td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>{{ 'common.email' | translate }}</th>
          <td mat-cell *matCellDef="let e">{{ e.email }}</td>
        </ng-container>
        <ng-container matColumnDef="job_title">
          <th mat-header-cell *matHeaderCellDef>{{ 'clients.jobTitle' | translate }}</th>
          <td mat-cell *matCellDef="let e">{{ e.job_title || '-' }}</td>
        </ng-container>
        <ng-container matColumnDef="phone">
          <th mat-header-cell *matHeaderCellDef>{{ 'common.phone' | translate }}</th>
          <td mat-cell *matCellDef="let e">{{ e.phone || '-' }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="employeeColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: employeeColumns"></tr>
      </table>

      <div *ngIf="!client.employees?.length" class="empty-state">
        {{ 'clients.noEmployees' | translate }}
      </div>
    </div>

    <!-- Add Employee overlay -->
    <div *ngIf="showAddEmployee" class="create-overlay">
      <div class="create-dialog flat-card">
        <div class="dialog-header">
          <h3>{{ 'clients.addEmployee' | translate }}</h3>
          <button class="close-btn" (click)="showAddEmployee = false"><mat-icon>close</mat-icon></button>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="flat-input-label">{{ 'common.email' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newEmployee.email" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'admin.firstName' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newEmployee.first_name" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'admin.lastName' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newEmployee.last_name" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'auth.password' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newEmployee.password" type="password" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'clients.jobTitle' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newEmployee.job_title" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'common.phone' | translate }}</label>
            <input class="flat-input" [(ngModel)]="newEmployee.phone" />
          </div>
        </div>
        <div *ngIf="createError" class="error-message">{{ createError }}</div>
        <div class="dialog-actions">
          <button class="flat-btn-outline" (click)="showAddEmployee = false">{{ 'common.cancel' | translate }}</button>
          <button class="flat-btn-primary" (click)="createEmployee()">{{ 'common.create' | translate }}</button>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .client-detail { max-width: 960px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px;
    }
    .page-header h2 { font-size: 22px; font-weight: 700; margin: 0; }
    .page-header a { text-decoration: none; }

    .detail-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
    }
    .detail-item { display: flex; flex-direction: column; gap: 4px; }
    .detail-label { font-size: 13px; color: var(--text-secondary, #6b7280); }
    .detail-value { font-size: 15px; font-weight: 500; }

    .type-badge {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      font-size: 12px; font-weight: 500;
    }
    .type-company { background: #dbeafe; color: #1d4ed8; }
    .type-individual { background: #f3f4f6; color: #6b7280; }

    .summary-title { font-size: 16px; font-weight: 600; margin: 24px 0 16px 0; }

    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
    }

    .section-header {
      display: flex; justify-content: space-between; align-items: center;
    }
    .count-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 22px; padding: 0 6px;
      border-radius: 12px; background: #e5e7eb; color: #374151;
      font-size: 12px; font-weight: 600; margin-left: 8px;
    }
    .btn-sm { font-size: 13px; padding: 6px 14px; }

    .full-width { width: 100%; margin-bottom: 16px; }

    .user-cell { display: flex; align-items: center; gap: 8px; }
    .user-cell-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: #e5e7eb; color: #6b7280;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 600; flex-shrink: 0;
    }

    .empty-state {
      padding: 24px; text-align: center;
      color: var(--text-secondary, #6b7280); font-size: 14px;
    }

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
    .error-message { color: #ef4444; font-size: 13px; margin-bottom: 12px; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientDetailComponent implements OnInit, OnDestroy {
  client: Client | null = null;
  summaryItems: { labelKey: string; value: number }[] = [];
  employeeColumns = ['name', 'email', 'job_title', 'phone'];
  isManager = false;
  showAddEmployee = false;
  createError = '';
  newEmployee = { email: '', first_name: '', last_name: '', password: '', job_title: '', phone: '' };
  private clientId = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private clientService: ClientService,
    private authService: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.clientId = +this.route.snapshot.params['id'];
    this.isManager = this.authService.hasRole('manager');
    this.loadClient();
  }

  loadClient(): void {
    this.clientService.get(this.clientId).pipe(takeUntil(this.destroy$)).subscribe((client) => {
      this.client = client;
      if (client.task_summary) {
        this.summaryItems = [
          { labelKey: 'clients.total', value: client.task_summary.total },
          { labelKey: 'statuses.created', value: client.task_summary.created },
          { labelKey: 'statuses.in_progress', value: client.task_summary.in_progress },
          { labelKey: 'statuses.waiting', value: client.task_summary.waiting },
          { labelKey: 'statuses.done', value: client.task_summary.done },
          { labelKey: 'statuses.archived', value: client.task_summary.archived },
        ];
      }
      this.cdr.markForCheck();
    });
  }

  createEmployee(): void {
    this.createError = '';
    const payload = {
      ...this.newEmployee,
      role: 'client',
      client_id: this.clientId,
    };
    this.http.post(`${environment.apiUrl}/users/`, payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showAddEmployee = false;
        this.newEmployee = { email: '', first_name: '', last_name: '', password: '', job_title: '', phone: '' };
        this.loadClient();
        this.cdr.markForCheck();
      },
      error: (err) => {
        const data = err.error;
        if (typeof data === 'object') {
          this.createError = Object.values(data).flat().join(' ');
        } else {
          this.createError = 'Failed to create employee';
        }
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
