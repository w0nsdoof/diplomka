import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { TaskService, TaskListItem, PaginatedResponse, TaskFilters } from '../../../../core/services/task.service';
import { AuthService } from '../../../../core/services/auth.service';
import { STATUS_TRANSLATION_KEYS, VALID_TRANSITIONS } from '../../../../core/constants/task-status';
import { SearchBarComponent } from '../../../../shared/components/search-bar/search-bar.component';
import { FilterPanelComponent, FilterState } from '../filter-panel/filter-panel.component';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatTableModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatPaginatorModule, MatMenuModule, MatSnackBarModule,
    SearchBarComponent, FilterPanelComponent, TranslateModule,
  ],
  template: `
    <div class="task-list-header">
      <h2>{{ 'tasks.title' | translate }}</h2>
      <a mat-raised-button color="primary" routerLink="new" *ngIf="canCreate">
        <mat-icon>add</mat-icon> {{ 'tasks.newTask' | translate }}
      </a>
    </div>

    <app-search-bar [placeholder]="'tasks.searchTasks' | translate" (search)="onSearch($event)"></app-search-bar>
    <app-filter-panel (filtersChange)="onFiltersChange($event)"></app-filter-panel>

    <table mat-table [dataSource]="tasks" class="full-width">
      <ng-container matColumnDef="title">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.taskTitle' | translate }}</th>
        <td mat-cell *matCellDef="let task">
          <a [routerLink]="[task.id]">{{ task.title }}</a>
        </td>
      </ng-container>

      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.status' | translate }}</th>
        <td mat-cell *matCellDef="let task">
          <mat-chip [class]="'status-' + task.status"
                    [matMenuTriggerFor]="getNextStatuses(task.status).length ? statusMenu : null"
                    [style.cursor]="getNextStatuses(task.status).length ? 'pointer' : 'default'">
            {{ statusLabel(task.status) }}
            <mat-icon *ngIf="getNextStatuses(task.status).length" iconPositionEnd style="font-size:16px;width:16px;height:16px">arrow_drop_down</mat-icon>
          </mat-chip>
          <mat-menu #statusMenu="matMenu">
            <button mat-menu-item *ngFor="let s of getNextStatuses(task.status)" (click)="onChangeStatus(task, s)">
              {{ statusLabel(s) }}
            </button>
          </mat-menu>
        </td>
      </ng-container>

      <ng-container matColumnDef="priority">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.priority' | translate }}</th>
        <td mat-cell *matCellDef="let task">
          <mat-chip [class]="'priority-' + task.priority">{{ 'priorities.' + task.priority | translate }}</mat-chip>
        </td>
      </ng-container>

      <ng-container matColumnDef="assignees">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.assignees' | translate }}</th>
        <td mat-cell *matCellDef="let task">
          <span *ngFor="let a of task.assignees; let last = last">
            {{ a.first_name }} {{ a.last_name }}<span *ngIf="!last">, </span>
          </span>
        </td>
      </ng-container>

      <ng-container matColumnDef="client">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.client' | translate }}</th>
        <td mat-cell *matCellDef="let task">{{ task.client?.name || '-' }}</td>
      </ng-container>

      <ng-container matColumnDef="tags">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.tags' | translate }}</th>
        <td mat-cell *matCellDef="let task">
          <mat-chip-set>
            <mat-chip *ngFor="let t of task.tags"
                      [style.background-color]="t.color"
                      [style.color]="isLightColor(t.color) ? '#000' : '#fff'"
                      class="tag-chip">
              {{ t.name }}
            </mat-chip>
          </mat-chip-set>
        </td>
      </ng-container>

      <ng-container matColumnDef="deadline">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.deadline' | translate }}</th>
        <td mat-cell *matCellDef="let task"
            [class.deadline-overdue]="isOverdue(task)">
          <ng-container *ngIf="isOverdue(task); else normalDeadline">
            {{ getOverdueDays(task) }} ({{ task.deadline | date:'mediumDate' }})
          </ng-container>
          <ng-template #normalDeadline>{{ task.deadline | date:'mediumDate' }}</ng-template>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
    </table>

    <mat-paginator
      [length]="totalCount"
      [pageSize]="pageSize"
      [pageIndex]="currentPage - 1"
      (page)="onPageChange($event)">
    </mat-paginator>
  `,
  styles: [`
    .task-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .full-width { width: 100%; }
    table { margin-bottom: 16px; }
    a { text-decoration: none; color: #1976d2; }
    .tag-chip { font-size: 11px; min-height: 24px; padding: 2px 8px; }
    .deadline-overdue { color: #d32f2f; font-weight: 500; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskListComponent implements OnInit, OnDestroy {
  tasks: TaskListItem[] = [];
  totalCount = 0;
  currentPage = 1;
  pageSize = 20;
  isManager = false;
  canCreate = false;
  displayedColumns = ['title', 'status', 'priority', 'assignees', 'client', 'tags', 'deadline'];
  private searchTerm = '';
  private activeFilters: FilterState = {};
  private destroy$ = new Subject<void>();

  constructor(
    private taskService: TaskService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
    this.canCreate = this.authService.hasAnyRole('manager', 'engineer');
    this.loadTasks();
  }

  loadTasks(): void {
    const filters: TaskFilters = {
      page: this.currentPage,
      page_size: this.pageSize,
      ...this.activeFilters,
    };
    if (this.searchTerm) {
      filters.search = this.searchTerm;
    }
    this.taskService.list(filters).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.tasks = res.results;
      this.totalCount = res.count;
      this.cdr.markForCheck();
    });
  }

  statusLabel(status: string): string {
    return this.translate.instant(STATUS_TRANSLATION_KEYS[status] || status);
  }

  getNextStatuses(currentStatus: string): string[] {
    const transitions = VALID_TRANSITIONS[currentStatus] || [];
    if (!this.isManager) {
      return transitions.filter((s: string) => !(currentStatus === 'done' && s === 'archived'));
    }
    return transitions;
  }

  onChangeStatus(task: TaskListItem, newStatus: string): void {
    this.taskService.changeStatus(task.id, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        task.status = newStatus;
        this.cdr.markForCheck();
      },
      error: (err) => {
        const msg = err.error?.detail || this.translate.instant('tasks.failedChangeStatus');
        this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 3000 });
      },
    });
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.currentPage = 1;
    this.loadTasks();
  }

  onFiltersChange(filters: FilterState): void {
    this.activeFilters = filters;
    this.currentPage = 1;
    this.loadTasks();
  }

  isOverdue(task: TaskListItem): boolean {
    if (task.status === 'done' || task.status === 'archived' || !task.deadline) {
      return false;
    }
    return new Date(task.deadline) < new Date();
  }

  getOverdueDays(task: TaskListItem): string {
    const deadline = new Date(task.deadline);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays}d`;
  }

  isLightColor(hex: string): boolean {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadTasks();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
