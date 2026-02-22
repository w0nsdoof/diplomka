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
import { Subject, takeUntil } from 'rxjs';
import { TaskService, TaskListItem, PaginatedResponse, TaskFilters } from '../../../../core/services/task.service';
import { AuthService } from '../../../../core/services/auth.service';
import { STATUS_LABELS, VALID_TRANSITIONS } from '../../../../core/constants/task-status';
import { SearchBarComponent } from '../../../../shared/components/search-bar/search-bar.component';
import { FilterPanelComponent, FilterState } from '../filter-panel/filter-panel.component';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatTableModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatPaginatorModule, MatMenuModule, MatSnackBarModule,
    SearchBarComponent, FilterPanelComponent,
  ],
  template: `
    <div class="task-list-header">
      <h2>Tasks</h2>
      <a mat-raised-button color="primary" routerLink="new" *ngIf="isManager">
        <mat-icon>add</mat-icon> New Task
      </a>
    </div>

    <app-search-bar placeholder="Search tasks..." (search)="onSearch($event)"></app-search-bar>
    <app-filter-panel (filtersChange)="onFiltersChange($event)"></app-filter-panel>

    <table mat-table [dataSource]="tasks" class="full-width">
      <ng-container matColumnDef="title">
        <th mat-header-cell *matHeaderCellDef>Title</th>
        <td mat-cell *matCellDef="let task">
          <a [routerLink]="[task.id]">{{ task.title }}</a>
        </td>
      </ng-container>

      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
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
        <th mat-header-cell *matHeaderCellDef>Priority</th>
        <td mat-cell *matCellDef="let task">
          <mat-chip [class]="'priority-' + task.priority">{{ task.priority }}</mat-chip>
        </td>
      </ng-container>

      <ng-container matColumnDef="assignees">
        <th mat-header-cell *matHeaderCellDef>Assignees</th>
        <td mat-cell *matCellDef="let task">
          <span *ngFor="let a of task.assignees; let last = last">
            {{ a.first_name }} {{ a.last_name }}<span *ngIf="!last">, </span>
          </span>
        </td>
      </ng-container>

      <ng-container matColumnDef="client">
        <th mat-header-cell *matHeaderCellDef>Client</th>
        <td mat-cell *matCellDef="let task">{{ task.client?.name || '-' }}</td>
      </ng-container>

      <ng-container matColumnDef="deadline">
        <th mat-header-cell *matHeaderCellDef>Deadline</th>
        <td mat-cell *matCellDef="let task">{{ task.deadline | date:'mediumDate' }}</td>
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskListComponent implements OnInit, OnDestroy {
  tasks: TaskListItem[] = [];
  totalCount = 0;
  currentPage = 1;
  pageSize = 20;
  isManager = false;
  displayedColumns = ['title', 'status', 'priority', 'assignees', 'client', 'deadline'];
  private searchTerm = '';
  private activeFilters: FilterState = {};
  private destroy$ = new Subject<void>();

  constructor(
    private taskService: TaskService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
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
    return STATUS_LABELS[status] || status;
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
        const msg = err.error?.detail || 'Failed to change status';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
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
