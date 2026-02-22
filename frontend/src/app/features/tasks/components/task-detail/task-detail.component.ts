import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { TaskService, TaskDetail } from '../../../../core/services/task.service';
import { AuthService } from '../../../../core/services/auth.service';
import { STATUS_LABELS, VALID_TRANSITIONS } from '../../../../core/constants/task-status';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatCardModule, MatChipsModule,
    MatButtonModule, MatIconModule, MatListModule, MatDividerModule,
    MatTabsModule, MatProgressBarModule, MatMenuModule, MatSnackBarModule,
  ],
  template: `
    <div *ngIf="task">
      <div class="header">
        <h2>{{ task.title }}</h2>
        <div class="actions">
          <a mat-button [routerLink]="['/tasks', task.id, 'edit']" *ngIf="isManager">
            <mat-icon>edit</mat-icon> Edit
          </a>
        </div>
      </div>

      <div class="meta">
        <mat-chip [class]="'status-' + task.status"
                  [matMenuTriggerFor]="getNextStatuses(task.status).length ? statusMenu : null"
                  [style.cursor]="getNextStatuses(task.status).length ? 'pointer' : 'default'">
          {{ statusLabel(task.status) }}
          <mat-icon *ngIf="getNextStatuses(task.status).length" iconPositionEnd style="font-size:18px;width:18px;height:18px">arrow_drop_down</mat-icon>
        </mat-chip>
        <mat-menu #statusMenu="matMenu">
          <button mat-menu-item *ngFor="let s of getNextStatuses(task.status)" (click)="onChangeStatus(s)">
            {{ statusLabel(s) }}
          </button>
        </mat-menu>
        <mat-chip [class]="'priority-' + task.priority">{{ task.priority }}</mat-chip>
        <span>Deadline: {{ task.deadline | date:'mediumDate' }}</span>
        <span *ngIf="task.client">Client: {{ task.client.name }}</span>
      </div>

      <mat-card class="description-card">
        <mat-card-content>
          <p>{{ task.description }}</p>
        </mat-card-content>
      </mat-card>

      <div class="info-grid">
        <div>
          <h4>Assignees</h4>
          <div *ngFor="let a of task.assignees">{{ a.first_name }} {{ a.last_name }}</div>
          <div *ngIf="!task.assignees.length">No assignees</div>
        </div>
        <div>
          <h4>Tags</h4>
          <mat-chip-set>
            <mat-chip *ngFor="let t of task.tags">{{ t.name }}</mat-chip>
          </mat-chip-set>
          <div *ngIf="!task.tags.length">No tags</div>
        </div>
        <div>
          <h4>Created by</h4>
          <span>{{ task.created_by?.first_name }} {{ task.created_by?.last_name }}</span>
          <br /><small>{{ task.created_at | date:'medium' }}</small>
        </div>
      </div>

      <mat-tab-group (selectedTabChange)="onTabChange($event)">
        <mat-tab label="Attachments ({{ attachments.length }})">
          <div class="tab-content">
            <div class="upload-row">
              <input type="file" #fileInput (change)="onFileSelected($event)" hidden />
              <button mat-raised-button color="primary" (click)="fileInput.click()" [disabled]="uploading">
                <mat-icon>upload</mat-icon> Upload File
              </button>
            </div>
            <mat-progress-bar *ngIf="uploading" mode="indeterminate"></mat-progress-bar>
            <mat-list *ngIf="attachments.length; else noAttachments">
              <mat-list-item *ngFor="let a of attachments">
                <mat-icon matListItemIcon>attach_file</mat-icon>
                <a matListItemTitle href="#" (click)="downloadAttachment(a.id, a.filename, $event)">{{ a.filename }}</a>
                <span matListItemLine>
                  {{ formatFileSize(a.file_size) }}
                  &middot; {{ a.uploaded_by?.first_name }} {{ a.uploaded_by?.last_name }}
                  &middot; {{ a.uploaded_at | date:'medium' }}
                </span>
                <button mat-icon-button *ngIf="isManager" (click)="deleteAttachment(a.id)" matListItemMeta>
                  <mat-icon>delete</mat-icon>
                </button>
              </mat-list-item>
            </mat-list>
            <ng-template #noAttachments>
              <p class="empty-message">No attachments</p>
            </ng-template>
          </div>
        </mat-tab>
        <mat-tab label="History" *ngIf="isManager">
          <div class="tab-content">
            <mat-progress-bar *ngIf="historyLoading" mode="indeterminate"></mat-progress-bar>
            <mat-list *ngIf="history.length; else noHistory">
              <mat-list-item *ngFor="let h of history">
                <mat-icon matListItemIcon>{{ getHistoryIcon(h.action) }}</mat-icon>
                <span matListItemTitle>
                  {{ h.action | titlecase }}{{ h.field_name ? ': ' + h.field_name : '' }}
                </span>
                <span matListItemLine>
                  <span *ngIf="h.old_value || h.new_value">{{ h.old_value || '(empty)' }} &rarr; {{ h.new_value || '(empty)' }}</span>
                  &middot; {{ h.changed_by?.first_name }} {{ h.changed_by?.last_name }}
                  &middot; {{ h.timestamp | date:'medium' }}
                </span>
              </mat-list-item>
            </mat-list>
            <ng-template #noHistory>
              <p *ngIf="historyLoaded" class="empty-message">No history</p>
            </ng-template>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; }
    .meta { display: flex; gap: 12px; align-items: center; margin: 16px 0; flex-wrap: wrap; }
    .description-card { margin: 16px 0; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin: 16px 0; }
    .tab-content { padding: 16px 0; }
    .upload-row { margin-bottom: 12px; }
    .empty-message { color: rgba(0, 0, 0, 0.54); padding: 16px 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetailComponent implements OnInit, OnDestroy {
  task: TaskDetail | null = null;
  isManager = false;
  attachments: any[] = [];
  history: any[] = [];
  historyLoaded = false;
  historyLoading = false;
  uploading = false;
  private taskId!: number;
  private destroy$ = new Subject<void>();
  private readonly historyTabIndex = 1;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private route: ActivatedRoute,
    private taskService: TaskService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
    this.taskId = +this.route.snapshot.params['id'];
    this.taskService.get(this.taskId).pipe(takeUntil(this.destroy$)).subscribe((task) => {
      this.task = task;
      this.cdr.markForCheck();
    });
    this.loadAttachments();
  }

  onTabChange(event: MatTabChangeEvent): void {
    if (event.index === this.historyTabIndex && !this.historyLoaded) {
      this.loadHistory();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading = true;
    this.cdr.markForCheck();
    this.taskService.uploadAttachment(this.taskId, file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.uploading = false;
          input.value = '';
          this.loadAttachments();
        },
        error: () => {
          this.uploading = false;
          input.value = '';
          this.cdr.markForCheck();
        },
      });
  }

  deleteAttachment(attachmentId: number): void {
    this.taskService.deleteAttachment(this.taskId, attachmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadAttachments());
  }

  downloadAttachment(attachmentId: number, filename: string, event: Event): void {
    event.preventDefault();
    this.taskService.downloadAttachment(this.taskId, attachmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  onChangeStatus(newStatus: string): void {
    if (!this.task) return;
    this.taskService.changeStatus(this.task.id, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.task!.status = newStatus;
        this.cdr.markForCheck();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Failed to change status';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      },
    });
  }

  getHistoryIcon(action: string): string {
    switch (action) {
      case 'created': return 'add_circle';
      case 'updated': return 'edit';
      case 'status_changed': return 'swap_horiz';
      case 'assigned': return 'person_add';
      case 'file_attached': return 'attach_file';
      default: return 'history';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAttachments(): void {
    this.taskService.getAttachments(this.taskId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.attachments = res.results;
        this.cdr.markForCheck();
      });
  }

  private loadHistory(): void {
    this.historyLoading = true;
    this.cdr.markForCheck();
    this.taskService.getHistory(this.taskId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.history = res.results;
        this.historyLoaded = true;
        this.historyLoading = false;
        this.cdr.markForCheck();
      });
  }
}
