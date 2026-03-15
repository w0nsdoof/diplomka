import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { TaskService, TaskListItem, TaskFilters } from '../../../../core/services/task.service';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { STATUS_TRANSLATION_KEYS, VALID_TRANSITIONS } from '../../../../core/constants/task-status';
import { SearchBarComponent } from '../../../../shared/components/search-bar/search-bar.component';
import { FilterPanelComponent, FilterState } from '../filter-panel/filter-panel.component';

interface KanbanColumn {
  status: string;
  label: string;
  tasks: TaskListItem[];
  color: string;
}

@Component({
    selector: 'app-kanban-board',
    imports: [CommonModule, DragDropModule, MatCardModule, MatChipsModule, MatIconModule, MatSnackBarModule, MatMenuModule, MatButtonModule, RouterModule, SearchBarComponent, FilterPanelComponent, TranslateModule],
    template: `
    <div class="page-header">
      <h2>{{ 'kanban.title' | translate }}</h2>
      <div class="view-toggle">
        <button class="toggle-btn" routerLink="/tasks">
          <mat-icon>table_chart</mat-icon>
          {{ 'tasks.list' | translate }}
        </button>
        <button class="toggle-btn active">
          <mat-icon>view_kanban</mat-icon>
          {{ 'tasks.kanban' | translate }}
        </button>
      </div>
    </div>
    <app-search-bar [placeholder]="'tasks.searchTasks' | translate" (search)="onSearch($event)"></app-search-bar>
    <app-filter-panel [showStatus]="false" [showClient]="false" (filtersChange)="onFiltersChange($event)"></app-filter-panel>
    <div class="kanban-container">
      <div class="kanban-column" *ngFor="let col of columns"
           cdkDropList [cdkDropListData]="col.tasks"
           [id]="col.status"
           [cdkDropListConnectedTo]="columnIds"
           (cdkDropListDropped)="onDrop($event, col)">
        <div class="column-header" [style.border-top-color]="col.color">
          <span class="column-title">{{ translate.instant(col.label) }}</span>
          <span class="column-count">{{ col.tasks.length }}</span>
        </div>
        <div class="kanban-card" *ngFor="let task of col.tasks" cdkDrag>
          <div class="card-top">
            <a [routerLink]="['/tasks', task.id]" class="card-title">{{ task.title }}</a>
            <button class="card-menu-btn" [matMenuTriggerFor]="cardStatusMenu"
                    *ngIf="getNextStatuses(task.status).length"
                    (click)="$event.stopPropagation()" cdkDragHandle>
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #cardStatusMenu="matMenu">
              <div class="menu-header" mat-menu-item disabled>{{ 'kanban.moveTo' | translate }}</div>
              <button mat-menu-item *ngFor="let s of getNextStatuses(task.status)"
                      (click)="onMenuChangeStatus(task, col, s)">
                {{ statusLabel(s) }}
              </button>
            </mat-menu>
          </div>
          <div class="card-client" *ngIf="task.client">{{ task.client.name }}</div>
          <div class="card-tags" *ngIf="task.tags.length">
            <span *ngFor="let t of task.tags" class="card-tag"
                  [style.border-color]="t.color"
                  [style.color]="t.color">
              {{ t.name }}
            </span>
          </div>
          <div class="card-assignee" *ngIf="task.assignees.length">
            <mat-icon class="card-icon">person</mat-icon>
            <span *ngFor="let a of task.assignees; let last = last">
              {{ a.first_name }} {{ a.last_name }}<span *ngIf="!last">, </span>
            </span>
          </div>
          <div class="card-footer">
            <span class="card-deadline" *ngIf="task.deadline">
              <mat-icon class="card-icon">calendar_today</mat-icon>
              {{ task.deadline | date:'shortDate' }}
            </span>
            <mat-chip [class]="'priority-' + task.priority" class="priority-badge">
              {{ 'priorities.' + task.priority | translate }}
            </mat-chip>
          </div>
        </div>
      </div>
    </div>
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
    .kanban-container { display: flex; gap: 16px; overflow-x: auto; min-height: 70vh; }
    .kanban-column {
      flex: 1; min-width: 280px;
      background: #fff;
      border-radius: var(--border-radius-card, 12px);
      padding: 0;
      border: 1px solid var(--border-color, #e5e7eb);
      display: flex;
      flex-direction: column;
    }
    .column-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 16px;
      border-top: 3px solid #ccc;
      border-radius: var(--border-radius-card, 12px) var(--border-radius-card, 12px) 0 0;
      font-weight: 600; font-size: 14px;
    }
    .column-count {
      background: #f3f4f6; border-radius: 12px;
      padding: 2px 10px; font-size: 13px; color: var(--text-secondary, #6b7280);
    }
    .kanban-card {
      margin: 0 12px 12px 12px; padding: 16px;
      background: #fff; border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 10px; cursor: grab;
      transition: box-shadow 0.15s;
    }
    .kanban-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .card-top { display: flex; align-items: flex-start; gap: 8px; }
    .card-title {
      flex: 1; text-decoration: none; color: var(--text-primary, #1a1a1a);
      font-weight: 500; font-size: 14px; line-height: 1.4;
    }
    .card-title:hover { color: var(--primary-blue, #1a7cf4); }
    .card-menu-btn {
      flex-shrink: 0; background: none; border: none; cursor: pointer;
      padding: 2px; color: #9ca3af; border-radius: 4px;
    }
    .card-menu-btn:hover { background: #f3f4f6; }
    .menu-header { font-size: 12px; opacity: 0.6; }
    .card-client {
      font-size: 13px; color: var(--primary-blue, #1a7cf4);
      margin-top: 8px; font-weight: 500;
    }
    .card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .card-tag {
      font-size: 11px; padding: 2px 8px; border-radius: 10px;
      white-space: nowrap; border: 1px solid; background: transparent;
    }
    .card-assignee {
      font-size: 12px; margin-top: 10px; color: var(--text-secondary, #6b7280);
      display: flex; align-items: center; gap: 4px;
    }
    .card-icon { font-size: 16px; width: 16px; height: 16px; color: #9ca3af; }
    .card-footer {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 10px;
    }
    .card-deadline {
      font-size: 12px; color: #9ca3af;
      display: flex; align-items: center; gap: 4px;
    }
    .priority-badge { font-size: 11px; }
    .cdk-drag-preview { box-shadow: 0 5px 20px rgba(0,0,0,.15); border-radius: 10px; }
    .cdk-drag-placeholder { opacity: 0; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class KanbanBoardComponent implements OnInit, OnDestroy {
  columns: KanbanColumn[] = [
    { status: 'created', label: 'statuses.created', tasks: [], color: '#9ca3af' },
    { status: 'in_progress', label: 'statuses.in_progress', tasks: [], color: '#f59e0b' },
    { status: 'waiting', label: 'statuses.waiting', tasks: [], color: '#ef4444' },
    { status: 'done', label: 'statuses.done', tasks: [], color: '#22c55e' },
  ];

  columnIds: string[] = [];
  private searchTerm = '';
  private activeFilters: FilterState = {};
  private destroy$ = new Subject<void>();

  constructor(
    private taskService: TaskService,
    private wsService: WebSocketService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public translate: TranslateService,
  ) {
    this.columnIds = this.columns.map((c) => c.status);
  }

  ngOnInit(): void {
    this.loadTasks();
    this.wsService.connect();
    this.wsService.messages$.pipe(takeUntil(this.destroy$)).subscribe((msg) => {
      if (msg.type === 'task_status_changed') {
        this.handleStatusChange(msg.payload);
      } else if (msg.type === 'task_created') {
        this.loadTasks();
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.disconnect();
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.loadTasks();
  }

  onFiltersChange(filters: FilterState): void {
    this.activeFilters = filters;
    this.loadTasks();
  }

  loadTasks(): void {
    const filters: TaskFilters = { page_size: 100, ...this.activeFilters };
    if (this.searchTerm) {
      filters.search = this.searchTerm;
    }
    this.taskService.list(filters).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      for (const col of this.columns) {
        col.tasks = res.results.filter((t) => t.status === col.status);
      }
      this.cdr.markForCheck();
    });
  }

  statusLabel(status: string): string {
    return this.translate.instant(STATUS_TRANSLATION_KEYS[status] || status);
  }

  getNextStatuses(currentStatus: string): string[] {
    return VALID_TRANSITIONS[currentStatus] || [];
  }

  isLightColor(hex: string): boolean {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  onMenuChangeStatus(task: TaskListItem, currentCol: KanbanColumn, newStatus: string): void {
    this.taskService.changeStatus(task.id, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        const idx = currentCol.tasks.indexOf(task);
        if (idx >= 0) currentCol.tasks.splice(idx, 1);
        task.status = newStatus;
        const targetCol = this.columns.find((c) => c.status === newStatus);
        targetCol?.tasks.push(task);
        this.cdr.markForCheck();
      },
      error: (err) => {
        const msg = err.error?.detail || this.translate.instant('kanban.invalidTransition');
        this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 3000 });
      },
    });
  }

  onDrop(event: CdkDragDrop<TaskListItem[]>, targetCol: KanbanColumn): void {
    if (event.previousContainer === event.container) return;
    const task = event.previousContainer.data[event.previousIndex];
    this.taskService.changeStatus(task.id, targetCol.status).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        event.previousContainer.data.splice(event.previousIndex, 1);
        task.status = targetCol.status;
        event.container.data.splice(event.currentIndex, 0, task);
        this.cdr.markForCheck();
      },
      error: (err) => {
        const msg = err.error?.detail || this.translate.instant('kanban.invalidTransition');
        this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 3000 });
        this.cdr.markForCheck();
      },
    });
  }

  private handleStatusChange(payload: any): void {
    const taskId = payload.task_id;
    const newStatus = payload.new_status;
    for (const col of this.columns) {
      const idx = col.tasks.findIndex((t) => t.id === taskId);
      if (idx >= 0) {
        const [task] = col.tasks.splice(idx, 1);
        task.status = newStatus;
        const target = this.columns.find((c) => c.status === newStatus);
        target?.tasks.push(task);
        break;
      }
    }
  }
}
