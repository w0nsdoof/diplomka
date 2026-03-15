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
    imports: [
        CommonModule, RouterModule, MatTableModule, MatButtonModule,
        MatIconModule, MatChipsModule, MatPaginatorModule, MatMenuModule, MatSnackBarModule,
        SearchBarComponent, FilterPanelComponent, TranslateModule,
    ],
    template: `
    <div class="page-header">
      <h2>{{ 'tasks.title' | translate }}</h2>
      <div class="header-right">
        <div class="view-toggle">
          <button class="toggle-btn active">
            <mat-icon>table_chart</mat-icon>
            {{ 'tasks.list' | translate }}
          </button>
          <button class="toggle-btn" routerLink="/kanban">
            <mat-icon>view_kanban</mat-icon>
            {{ 'tasks.kanban' | translate }}
          </button>
        </div>
        <button class="flat-btn-primary" routerLink="new" *ngIf="canCreate">
          <mat-icon>add</mat-icon> {{ 'tasks.add' | translate }}
        </button>
      </div>
    </div>

    <!-- Status tabs -->
    <div class="status-tabs">
      <button class="status-tab" [class.active]="!statusFilter" (click)="onStatusFilter(undefined)">
        {{ 'common.all' | translate }}
      </button>
      <button class="status-tab" [class.active]="statusFilter === 'created'" (click)="onStatusFilter('created')">
        {{ 'statuses.created' | translate }}
      </button>
      <button class="status-tab" [class.active]="statusFilter === 'in_progress'" (click)="onStatusFilter('in_progress')">
        {{ 'statuses.in_progress' | translate }}
      </button>
      <button class="status-tab" [class.active]="statusFilter === 'waiting'" (click)="onStatusFilter('waiting')">
        {{ 'statuses.waiting' | translate }}
      </button>
      <button class="status-tab" [class.active]="statusFilter === 'done'" (click)="onStatusFilter('done')">
        {{ 'statuses.done' | translate }}
      </button>
    </div>

    <app-search-bar [placeholder]="'tasks.searchTasks' | translate" (search)="onSearch($event)"></app-search-bar>
    <app-filter-panel [showStatus]="false" (filtersChange)="onFiltersChange($event)"></app-filter-panel>

    <table mat-table [dataSource]="tasks" class="full-width">
      <ng-container matColumnDef="title">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.taskTitle' | translate }}</th>
        <td mat-cell *matCellDef="let task">
          <a [routerLink]="[task.id]" class="task-link">{{ task.title }}</a>
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
          <div class="assignee-list">
            <span *ngFor="let a of task.assignees; let last = last" class="assignee-name">
              <span class="mini-avatar">{{ a.first_name?.charAt(0) || '' }}</span>
              {{ a.first_name }} {{ a.last_name }}<span *ngIf="!last">, </span>
            </span>
          </div>
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
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .page-header h2 {
      font-size: 22px;
      font-weight: 700;
      margin: 0;
    }
    .header-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .full-width { width: 100%; }
    table { margin-bottom: 16px; }
    .task-link { text-decoration: none; color: var(--primary-blue, #1a7cf4); font-weight: 500; }
    .task-link:hover { text-decoration: underline; }
    .tag-chip { font-size: 11px; min-height: 24px; padding: 2px 8px; }
    .deadline-overdue { color: #d32f2f; font-weight: 500; }
    .assignee-list { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .assignee-name { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
    .mini-avatar {
      width: 24px; height: 24px; border-radius: 50%;
      background: #e5e7eb; color: #6b7280;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600; flex-shrink: 0;
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListComponent implements OnInit, OnDestroy {
  tasks: TaskListItem[] = [];
  totalCount = 0;
  currentPage = 1;
  pageSize = 20;
  isManager = false;
  canCreate = false;
  statusFilter: string | undefined = undefined;
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
    if (this.statusFilter) {
      filters.status = this.statusFilter;
    }
    this.taskService.list(filters).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.tasks = res.results;
      this.totalCount = res.count;
      this.cdr.markForCheck();
    });
  }

  onStatusFilter(status: string | undefined): void {
    this.statusFilter = status;
    this.currentPage = 1;
    this.loadTasks();
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
