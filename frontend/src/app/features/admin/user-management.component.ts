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
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCardModule, MatChipsModule,
  ],
  template: `
    <div class="header">
      <h2>User Management</h2>
      <button mat-raised-button color="primary" (click)="showCreateForm = !showCreateForm">
        <mat-icon>person_add</mat-icon> New User
      </button>
    </div>

    <mat-card *ngIf="showCreateForm" class="create-form">
      <mat-card-content>
        <h3>Create User</h3>
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput [(ngModel)]="newUser.email" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>First Name</mat-label><input matInput [(ngModel)]="newUser.first_name" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Last Name</mat-label><input matInput [(ngModel)]="newUser.last_name" /></mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>Role</mat-label>
            <mat-select [(ngModel)]="newUser.role">
              <mat-option value="manager">Manager</mat-option>
              <mat-option value="engineer">Engineer</mat-option>
              <mat-option value="client">Client</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Password</mat-label><input matInput [(ngModel)]="newUser.password" type="password" /></mat-form-field>
        </div>
        <button mat-raised-button color="primary" (click)="createUser()">Create</button>
        <button mat-button (click)="showCreateForm = false">Cancel</button>
      </mat-card-content>
    </mat-card>

    <table mat-table [dataSource]="users" class="full-width">
      <ng-container matColumnDef="email"><th mat-header-cell *matHeaderCellDef>Email</th><td mat-cell *matCellDef="let u">{{ u.email }}</td></ng-container>
      <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Name</th><td mat-cell *matCellDef="let u">{{ u.first_name }} {{ u.last_name }}</td></ng-container>
      <ng-container matColumnDef="role"><th mat-header-cell *matHeaderCellDef>Role</th><td mat-cell *matCellDef="let u"><mat-chip>{{ u.role }}</mat-chip></td></ng-container>
      <ng-container matColumnDef="is_active"><th mat-header-cell *matHeaderCellDef>Active</th><td mat-cell *matCellDef="let u">{{ u.is_active ? 'Yes' : 'No' }}</td></ng-container>
      <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>Actions</th>
        <td mat-cell *matCellDef="let u">
          <button mat-icon-button color="warn" (click)="deactivateUser(u.id)" *ngIf="u.is_active"><mat-icon>block</mat-icon></button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .full-width { width: 100%; }
    .create-form { margin-bottom: 24px; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .form-row mat-form-field { flex: 1; min-width: 200px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserManagementComponent implements OnInit, OnDestroy {
  users: any[] = [];
  columns = ['email', 'name', 'role', 'is_active', 'actions'];
  showCreateForm = false;
  newUser = { email: '', first_name: '', last_name: '', role: 'engineer', password: '' };
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.loadUsers(); }

  loadUsers(): void {
    this.http.get<any>(`${environment.apiUrl}/users/`).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.users = res.results;
      this.cdr.markForCheck();
    });
  }

  createUser(): void {
    this.http.post(`${environment.apiUrl}/users/`, this.newUser).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showCreateForm = false;
      this.newUser = { email: '', first_name: '', last_name: '', role: 'engineer', password: '' };
      this.loadUsers();
      this.cdr.markForCheck();
    });
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
