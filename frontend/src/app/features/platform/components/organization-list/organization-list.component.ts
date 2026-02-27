import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Organization, OrganizationService } from '../../../../core/services/organization.service';
import { OrganizationFormComponent } from '../organization-form/organization-form.component';

@Component({
  selector: 'app-organization-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="header">
      <h2>{{ 'platform.organizations' | translate }}</h2>
      <button mat-raised-button color="primary" (click)="openCreateDialog()">
        <mat-icon>add</mat-icon> {{ 'platform.newOrganization' | translate }}
      </button>
    </div>

    <table mat-table [dataSource]="organizations" class="full-width">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.name' | translate }}</th>
        <td mat-cell *matCellDef="let org">{{ org.name }}</td>
      </ng-container>

      <ng-container matColumnDef="slug">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.slug' | translate }}</th>
        <td mat-cell *matCellDef="let org">{{ org.slug }}</td>
      </ng-container>

      <ng-container matColumnDef="is_active">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.status' | translate }}</th>
        <td mat-cell *matCellDef="let org">
          <mat-chip [highlighted]="org.is_active" [color]="org.is_active ? 'primary' : 'warn'">
            {{ org.is_active ? ('common.active' | translate) : ('common.inactive' | translate) }}
          </mat-chip>
        </td>
      </ng-container>

      <ng-container matColumnDef="user_count">
        <th mat-header-cell *matHeaderCellDef>{{ 'platform.users' | translate }}</th>
        <td mat-cell *matCellDef="let org">{{ org.user_count }}</td>
      </ng-container>

      <ng-container matColumnDef="task_count">
        <th mat-header-cell *matHeaderCellDef>{{ 'platform.tasks' | translate }}</th>
        <td mat-cell *matCellDef="let org">{{ org.task_count }}</td>
      </ng-container>

      <ng-container matColumnDef="created_at">
        <th mat-header-cell *matHeaderCellDef>{{ 'platform.joined' | translate }}</th>
        <td mat-cell *matCellDef="let org">{{ org.created_at | date:'mediumDate' }}</td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns;" (click)="goToDetail(row)" class="clickable-row"></tr>
    </table>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .full-width { width: 100%; }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background-color: rgba(0, 0, 0, 0.04); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationListComponent implements OnInit, OnDestroy {
  organizations: Organization[] = [];
  displayedColumns = ['name', 'slug', 'is_active', 'user_count', 'task_count', 'created_at'];
  private destroy$ = new Subject<void>();

  constructor(
    private orgService: OrganizationService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.loadOrganizations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrganizations(): void {
    this.orgService.list().pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.organizations = res.results;
      this.cdr.markForCheck();
    });
  }

  goToDetail(org: Organization): void {
    this.router.navigate(['/platform/organizations', org.id]);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(OrganizationFormComponent, {
      width: '400px',
    });
    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (result) {
        this.snackBar.open(this.translate.instant('platform.organizationCreated'), this.translate.instant('common.ok'), { duration: 3000 });
        this.loadOrganizations();
      }
    });
  }
}
