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
import { HttpParams } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCardModule, MatChipsModule, SearchBarComponent, TranslateModule,
  ],
  template: `
    <div class="header">
      <h2>{{ 'admin.title' | translate }}</h2>
      <button mat-raised-button color="primary" (click)="showCreateForm = !showCreateForm">
        <mat-icon>person_add</mat-icon> {{ 'admin.newUser' | translate }}
      </button>
    </div>

    <mat-card *ngIf="showCreateForm" class="create-form">
      <mat-card-content>
        <h3>{{ 'admin.createUser' | translate }}</h3>
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>{{ 'common.email' | translate }}</mat-label><input matInput [(ngModel)]="newUser.email" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'admin.firstName' | translate }}</mat-label><input matInput [(ngModel)]="newUser.first_name" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'admin.lastName' | translate }}</mat-label><input matInput [(ngModel)]="newUser.last_name" /></mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>{{ 'admin.role' | translate }}</mat-label>
            <mat-select [(ngModel)]="newUser.role">
              <mat-option value="manager">{{ 'admin.manager' | translate }}</mat-option>
              <mat-option value="engineer">{{ 'admin.engineer' | translate }}</mat-option>
              <mat-option value="client">{{ 'admin.client' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'auth.password' | translate }}</mat-label><input matInput [(ngModel)]="newUser.password" type="password" /></mat-form-field>
        </div>
        <button mat-raised-button color="primary" (click)="createUser()">{{ 'common.create' | translate }}</button>
        <button mat-button (click)="showCreateForm = false">{{ 'common.cancel' | translate }}</button>
      </mat-card-content>
    </mat-card>

    <app-search-bar [placeholder]="'admin.searchUsers' | translate" (search)="onSearch($event)"></app-search-bar>

    <table mat-table [dataSource]="users" class="full-width">
      <ng-container matColumnDef="email"><th mat-header-cell *matHeaderCellDef>{{ 'common.email' | translate }}</th><td mat-cell *matCellDef="let u">{{ u.email }}</td></ng-container>
      <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>{{ 'common.name' | translate }}</th><td mat-cell *matCellDef="let u">{{ u.first_name }} {{ u.last_name }}</td></ng-container>
      <ng-container matColumnDef="role"><th mat-header-cell *matHeaderCellDef>{{ 'admin.role' | translate }}</th><td mat-cell *matCellDef="let u"><mat-chip>{{ u.role }}</mat-chip></td></ng-container>
      <ng-container matColumnDef="is_active"><th mat-header-cell *matHeaderCellDef>{{ 'common.active' | translate }}</th><td mat-cell *matCellDef="let u">{{ u.is_active ? ('common.yes' | translate) : ('common.no' | translate) }}</td></ng-container>
      <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | translate }}</th>
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
