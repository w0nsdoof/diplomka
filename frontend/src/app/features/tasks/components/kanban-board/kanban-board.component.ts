import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskService, TaskListItem } from '../../../../core/services/task.service';
import { WebSocketService } from '../../../../core/services/websocket.service';

interface KanbanColumn {
  status: string;
  label: string;
  tasks: TaskListItem[];
}

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, DragDropModule, MatCardModule, MatChipsModule, MatIconModule, MatSnackBarModule, RouterModule],
  template: `
    <h2>Kanban Board</h2>
    <div class="kanban-container">
      <div class="kanban-column" *ngFor="let col of columns"
           cdkDropList [cdkDropListData]="col.tasks"
           [id]="col.status"
           [cdkDropListConnectedTo]="columnIds"
           (cdkDropListDropped)="onDrop($event, col)">
        <h3 class="column-header">{{ col.label }} ({{ col.tasks.length }})</h3>
        <mat-card *ngFor="let task of col.tasks" cdkDrag class="kanban-card" [class]="'priority-' + task.priority">
          <mat-card-header>
            <mat-card-title>
              <a [routerLink]="['/tasks', task.id]">{{ task.title }}</a>
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-chip [class]="'priority-' + task.priority">{{ task.priority }}</mat-chip>
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
    .assignees { font-size: 12px; margin-top: 8px; color: #616161; }
    .deadline { font-size: 12px; margin-top: 4px; color: #9e9e9e; }
    .cdk-drag-preview { box-shadow: 0 5px 5px -3px rgba(0,0,0,.2); }
    .cdk-drag-placeholder { opacity: 0; }
  `],
})
export class KanbanBoardComponent implements OnInit, OnDestroy {
  columns: KanbanColumn[] = [
    { status: 'created', label: 'Created', tasks: [] },
    { status: 'in_progress', label: 'In Progress', tasks: [] },
    { status: 'waiting', label: 'Waiting', tasks: [] },
    { status: 'done', label: 'Done', tasks: [] },
  ];

  columnIds: string[] = [];
  private wsSub?: Subscription;

  constructor(
    private taskService: TaskService,
    private wsService: WebSocketService,
    private snackBar: MatSnackBar,
  ) {
    this.columnIds = this.columns.map((c) => c.status);
  }

  ngOnInit(): void {
    this.loadTasks();
    this.wsService.connect();
    this.wsSub = this.wsService.messages$.subscribe((msg) => {
      if (msg.type === 'task_status_changed') {
        this.handleStatusChange(msg.payload);
      } else if (msg.type === 'task_created') {
        this.loadTasks();
      }
    });
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
    this.wsService.disconnect();
  }

  loadTasks(): void {
    this.taskService.list({ page_size: 100 }).subscribe((res) => {
      for (const col of this.columns) {
        col.tasks = res.results.filter((t) => t.status === col.status);
      }
    });
  }

  onDrop(event: CdkDragDrop<TaskListItem[]>, targetCol: KanbanColumn): void {
    if (event.previousContainer === event.container) return;
    const task = event.previousContainer.data[event.previousIndex];
    this.taskService.changeStatus(task.id, targetCol.status).subscribe({
      next: () => {
        event.previousContainer.data.splice(event.previousIndex, 1);
        task.status = targetCol.status;
        event.container.data.splice(event.currentIndex, 0, task);
      },
      error: (err) => {
        const msg = err.error?.detail || 'Invalid transition';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
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
