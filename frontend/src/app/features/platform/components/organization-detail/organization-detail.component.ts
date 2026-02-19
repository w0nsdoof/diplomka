import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, takeUntil } from 'rxjs';
import {
  ManagerBrief,
  OrganizationDetail,
  OrganizationService,
} from '../../../../core/services/organization.service';

@Component({
  selector: 'app-organization-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatDividerModule,
  ],
  template: `
    <div *ngIf="org">
      <mat-card>
        <mat-card-header>
          <mat-card-title>{{ org.name }}</mat-card-title>
          <mat-card-subtitle>{{ org.slug }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="stats-grid">
            <div class="stat">
              <span class="stat-label">Status</span>
              <mat-chip [highlighted]="org.is_active" [color]="org.is_active ? 'primary' : 'warn'">
                {{ org.is_active ? 'Active' : 'Inactive' }}
              </mat-chip>
            </div>
            <div class="stat">
              <span class="stat-label">Total Users</span>
              <span class="stat-value">{{ org.user_count }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Managers</span>
              <span class="stat-value">{{ org.manager_count }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Engineers</span>
              <span class="stat-value">{{ org.engineer_count }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Client Users</span>
              <span class="stat-value">{{ org.client_user_count }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Tasks</span>
              <span class="stat-value">{{ org.task_count }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Clients</span>
              <span class="stat-value">{{ org.client_count }}</span>
            </div>
          </div>

          <div class="actions">
            <button mat-raised-button [color]="org.is_active ? 'warn' : 'primary'" (click)="toggleActive()">
              <mat-icon>{{ org.is_active ? 'block' : 'check_circle' }}</mat-icon>
              {{ org.is_active ? 'Deactivate' : 'Reactivate' }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-divider style="margin: 24px 0;"></mat-divider>

      <h3>Managers</h3>

      <table mat-table [dataSource]="managers" class="full-width" *ngIf="managers.length > 0">
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let m">{{ m.email }}</td>
        </ng-container>
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let m">{{ m.first_name }} {{ m.last_name }}</td>
        </ng-container>
        <ng-container matColumnDef="is_active">
          <th mat-header-cell *matHeaderCellDef>Active</th>
          <td mat-cell *matCellDef="let m">{{ m.is_active ? 'Yes' : 'No' }}</td>
        </ng-container>
        <ng-container matColumnDef="date_joined">
          <th mat-header-cell *matHeaderCellDef>Joined</th>
          <td mat-cell *matCellDef="let m">{{ m.date_joined | date:'mediumDate' }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="managerColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: managerColumns;"></tr>
      </table>

      <p *ngIf="managers.length === 0">No managers yet.</p>

      <mat-divider style="margin: 24px 0;"></mat-divider>

      <h3>Add Manager</h3>
      <form [formGroup]="managerForm" (ngSubmit)="createManager()" class="manager-form">
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>First Name</mat-label>
          <input matInput formControlName="first_name" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Last Name</mat-label>
          <input matInput formControlName="last_name" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput formControlName="password" type="password" />
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit" [disabled]="managerForm.invalid || creating">
          Add Manager
        </button>
      </form>
      <div *ngIf="managerError" class="error-message">{{ managerError }}</div>
    </div>
  `,
  styles: [`
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; margin: 16px 0; }
    .stat { display: flex; flex-direction: column; }
    .stat-label { font-size: 12px; color: #666; }
    .stat-value { font-size: 20px; font-weight: 500; }
    .actions { margin-top: 16px; }
    .full-width { width: 100%; }
    .manager-form { display: flex; gap: 12px; flex-wrap: wrap; align-items: baseline; }
    .error-message { color: #f44336; margin-top: 8px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationDetailComponent implements OnInit, OnDestroy {
  org: OrganizationDetail | null = null;
  managers: ManagerBrief[] = [];
  managerColumns = ['email', 'name', 'is_active', 'date_joined'];
  managerForm: FormGroup;
  creating = false;
  managerError = '';
  private orgId!: number;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private orgService: OrganizationService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {
    this.managerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnInit(): void {
    this.orgId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadOrg();
    this.loadManagers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrg(): void {
    this.orgService.get(this.orgId).pipe(takeUntil(this.destroy$)).subscribe((org) => {
      this.org = org;
      this.cdr.markForCheck();
    });
  }

  loadManagers(): void {
    this.orgService.listManagers(this.orgId).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.managers = res.results;
      this.cdr.markForCheck();
    });
  }

  toggleActive(): void {
    if (!this.org) return;
    this.orgService.update(this.orgId, { is_active: !this.org.is_active }).pipe(takeUntil(this.destroy$)).subscribe((org) => {
      this.org = org;
      this.snackBar.open(
        org.is_active ? 'Organization reactivated' : 'Organization deactivated',
        'OK',
        { duration: 3000 },
      );
      this.cdr.markForCheck();
    });
  }

  createManager(): void {
    if (this.managerForm.invalid) return;
    this.creating = true;
    this.managerError = '';

    this.orgService.createManager(this.orgId, this.managerForm.value).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open('Manager created', 'OK', { duration: 3000 });
        this.managerForm.reset();
        this.loadManagers();
        this.loadOrg();
        this.creating = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.creating = false;
        this.managerError = err.error?.email?.[0] || err.error?.detail || 'Failed to create manager.';
        this.cdr.markForCheck();
      },
    });
  }
}
