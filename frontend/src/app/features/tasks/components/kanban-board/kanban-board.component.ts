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
}

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, DragDropModule, MatCardModule, MatChipsModule, MatIconModule, MatSnackBarModule, MatMenuModule, MatButtonModule, RouterModule, SearchBarComponent, FilterPanelComponent, TranslateModule],
  template: `
    <h2>{{ 'kanban.title' | translate }}</h2>
    <app-search-bar [placeholder]="'tasks.searchTasks' | translate" (search)="onSearch($event)"></app-search-bar>
    <app-filter-panel [showStatus]="false" [showClient]="false" (filtersChange)="onFiltersChange($event)"></app-filter-panel>
    <div class="kanban-container">
      <div class="kanban-column" *ngFor="let col of columns"
           cdkDropList [cdkDropListData]="col.tasks"
           [id]="col.status"
           [cdkDropListConnectedTo]="columnIds"
           (cdkDropListDropped)="onDrop($event, col)">
        <h3 class="column-header">{{ translate.instant(col.label) }} ({{ col.tasks.length }})</h3>
        <mat-card *ngFor="let task of col.tasks" cdkDrag class="kanban-card" [class]="'priority-' + task.priority">
          <mat-card-header>
            <mat-card-title>
              <a [routerLink]="['/tasks', task.id]">{{ task.title }}</a>
            </mat-card-title>
            <button mat-icon-button [matMenuTriggerFor]="cardStatusMenu"
                    *ngIf="getNextStatuses(task.status).length"
                    (click)="$event.stopPropagation()"
                    class="card-menu-btn" cdkDragHandle>
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #cardStatusMenu="matMenu">
              <div class="menu-header" mat-menu-item disabled>{{ 'kanban.moveTo' | translate }}</div>
              <button mat-menu-item *ngFor="let s of getNextStatuses(task.status)"
                      (click)="onMenuChangeStatus(task, col, s)">
                {{ statusLabel(s) }}
              </button>
            </mat-menu>
          </mat-card-header>
          <mat-card-content>
            <mat-chip [class]="'priority-' + task.priority">{{ 'priorities.' + task.priority | translate }}</mat-chip>
            <div class="card-tags" *ngIf="task.tags.length">
              <span *ngFor="let t of task.tags" class="card-tag"
                    [style.background-color]="t.color"
                    [style.color]="isLightColor(t.color) ? '#000' : '#fff'">
                {{ t.name }}
              </span>
            </div>
            <div class="assignees" *ngIf="task.assignees.length">
              <span *ngFor="let a of task.assignees; let last = last">
                {{ a.first_name }} {{ a.last_name }}<span *ngIf="!last">, </span>
              </span>
            </div>
            <div class="deadline" *ngIf="task.deadline">
              {{ task.deadline | date:'shortDate' }}
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .kanban-container { display: flex; gap: 16px; overflow-x: auto; min-height: 70vh; }
    .kanban-column { flex: 1; min-width: 250px; background: #f5f5f5; border-radius: 8px; padding: 12px; }
    .column-header { text-align: center; margin-bottom: 12px; }
    .kanban-card { margin-bottom: 8px; cursor: grab; }
    .kanban-card a { text-decoration: none; color: inherit; }
    .kanban-card mat-card-header { display: flex; align-items: center; }
    .kanban-card mat-card-header mat-card-title { flex: 1; }
    .card-menu-btn { flex-shrink: 0; margin: -8px -8px -8px 0; }
    .menu-header { font-size: 12px; opacity: 0.6; }
    .card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .card-tag { font-size: 11px; padding: 1px 6px; border-radius: 10px; white-space: nowrap; }
    .assignees { font-size: 12px; margin-top: 8px; color: #616161; }
    .deadline { font-size: 12px; margin-top: 4px; color: #9e9e9e; }
    .cdk-drag-preview { box-shadow: 0 5px 5px -3px rgba(0,0,0,.2); }
    .cdk-drag-placeholder { opacity: 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanBoardComponent implements OnInit, OnDestroy {
  columns: KanbanColumn[] = [
    { status: 'created', label: 'statuses.created', tasks: [] },
    { status: 'in_progress', label: 'statuses.in_progress', tasks: [] },
    { status: 'waiting', label: 'statuses.waiting', tasks: [] },
    { status: 'done', label: 'statuses.done', tasks: [] },
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
