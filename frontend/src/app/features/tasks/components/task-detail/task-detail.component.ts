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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { TaskService, TaskDetail } from '../../../../core/services/task.service';
import { AuthService } from '../../../../core/services/auth.service';
import { STATUS_TRANSLATION_KEYS, VALID_TRANSITIONS } from '../../../../core/constants/task-status';
import { CommentSectionComponent } from '../comment-section/comment-section.component';

@Component({
    selector: 'app-task-detail',
    imports: [
        CommonModule, RouterModule, MatCardModule, MatChipsModule,
        MatButtonModule, MatIconModule, MatListModule, MatDividerModule,
        MatTabsModule, MatProgressBarModule, MatMenuModule, MatSnackBarModule,
        TranslateModule, CommentSectionComponent,
    ],
    template: `
    <div *ngIf="task" class="task-detail">
      <div class="detail-header">
        <div class="header-left">
          <span class="header-label">{{ 'tasks.taskTopic' | translate }}</span>
          <h2 class="task-title">{{ task.title }}</h2>
        </div>
        <div class="header-right">
          <mat-chip [class]="'status-' + task.status"
                    [matMenuTriggerFor]="getNextStatuses(task.status).length ? statusMenu : null"
                    [style.cursor]="getNextStatuses(task.status).length ? 'pointer' : 'default'"
                    class="status-badge">
            {{ statusLabel(task.status) }}
            <mat-icon *ngIf="getNextStatuses(task.status).length" iconPositionEnd style="font-size:18px;width:18px;height:18px">arrow_drop_down</mat-icon>
          </mat-chip>
          <mat-menu #statusMenu="matMenu">
            <button mat-menu-item *ngFor="let s of getNextStatuses(task.status)" (click)="onChangeStatus(s)">
              {{ statusLabel(s) }}
            </button>
          </mat-menu>
          <a class="flat-btn-primary edit-btn" [routerLink]="['/tasks', task.id, 'edit']" *ngIf="canEdit">
            <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
          </a>
        </div>
      </div>

      <!-- Metadata row -->
      <div class="meta-row">
        <div class="meta-item">
          <mat-icon class="meta-icon">calendar_today</mat-icon>
          <div>
            <span class="meta-label">{{ 'tasks.createdAt' | translate }}</span>
            <span class="meta-value">{{ task.created_at | date:'mediumDate' }}</span>
          </div>
        </div>
        <div class="meta-item" *ngIf="task.tags.length">
          <mat-icon class="meta-icon">label</mat-icon>
          <div>
            <span class="meta-label">{{ 'tasks.tags' | translate }}</span>
            <span class="meta-value">
              <mat-chip *ngFor="let t of task.tags" class="mini-tag">{{ t.name }}</mat-chip>
            </span>
          </div>
        </div>
        <div class="meta-item">
          <mat-icon class="meta-icon">event</mat-icon>
          <div>
            <span class="meta-label">{{ 'tasks.deadline' | translate }}</span>
            <span class="meta-value">{{ task.deadline | date:'mediumDate' }}</span>
          </div>
        </div>
        <div class="meta-item" *ngIf="task.client">
          <mat-icon class="meta-icon">apartment</mat-icon>
          <div>
            <span class="meta-label">{{ 'tasks.client' | translate }}</span>
            <span class="meta-value">{{ task.client.name }}</span>
          </div>
        </div>
        <div class="meta-item">
          <mat-icon class="meta-icon">person</mat-icon>
          <div>
            <span class="meta-label">{{ 'tasks.createdBy' | translate }}</span>
            <span class="meta-value">{{ task.created_by?.first_name }} {{ task.created_by?.last_name }}</span>
          </div>
        </div>
        <div class="meta-item" *ngIf="task.assignees.length">
          <mat-icon class="meta-icon">group</mat-icon>
          <div>
            <span class="meta-label">{{ 'tasks.assignees' | translate }}</span>
            <span class="meta-value assignee-flex">
              <span *ngFor="let a of task.assignees" class="assignee-pill">
                <span class="mini-avatar">{{ a.first_name?.charAt(0) || '' }}</span>
                {{ a.first_name }} {{ a.last_name }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <mat-chip [class]="'priority-' + task.priority" class="priority-tag">
        {{ 'priorities.' + task.priority | translate }}
      </mat-chip>

      <!-- Description -->
      <div class="description-section flat-card">
        <h3>{{ 'tasks.description' | translate }}</h3>
        <p class="description-text">{{ task.description }}</p>
      </div>

      <!-- Tabs -->
      <mat-tab-group (selectedTabChange)="onTabChange($event)">
        <mat-tab [label]="translate.instant('tasks.attachments') + ' (' + attachments.length + ')'">
          <div class="tab-content">
            <div class="upload-row">
              <input type="file" #fileInput (change)="onFileSelected($event)" hidden />
              <button class="flat-btn-primary" (click)="fileInput.click()" [disabled]="uploading">
                <mat-icon>upload</mat-icon> {{ 'tasks.uploadFile' | translate }}
              </button>
            </div>
            <mat-progress-bar *ngIf="uploading" mode="indeterminate"></mat-progress-bar>
            <div *ngIf="attachments.length; else noAttachments" class="attachment-list">
              <div *ngFor="let a of attachments" class="attachment-item">
                <mat-icon class="file-icon">attach_file</mat-icon>
                <div class="attachment-info">
                  <a href="#" (click)="downloadAttachment(a.id, a.filename, $event)" class="attachment-name">{{ a.filename }}</a>
                  <span class="attachment-meta">
                    {{ formatFileSize(a.file_size) }}
                    &middot; {{ a.uploaded_by?.first_name }} {{ a.uploaded_by?.last_name }}
                    &middot; {{ a.uploaded_at | date:'medium' }}
                  </span>
                </div>
                <button *ngIf="isManager" class="delete-btn" (click)="deleteAttachment(a.id)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
            <ng-template #noAttachments>
              <p class="empty-message">{{ 'tasks.noAttachments' | translate }}</p>
            </ng-template>
          </div>
        </mat-tab>
        <mat-tab [label]="translate.instant('comments.title')">
          <div class="tab-content">
            <app-comment-section [taskId]="task.id"></app-comment-section>
          </div>
        </mat-tab>
        <mat-tab [label]="translate.instant('tasks.history')" *ngIf="canViewHistory">
          <div class="tab-content">
            <mat-progress-bar *ngIf="historyLoading" mode="indeterminate"></mat-progress-bar>
            <div *ngIf="history.length; else noHistory" class="history-list">
              <div *ngFor="let h of history" class="history-item">
                <mat-icon class="history-icon">{{ getHistoryIcon(h.action) }}</mat-icon>
                <div class="history-info">
                  <span class="history-action">
                    {{ h.action | titlecase }}{{ h.field_name ? ': ' + h.field_name : '' }}
                  </span>
                  <span class="history-detail">
                    <span *ngIf="h.old_value || h.new_value">{{ h.old_value || translate.instant('tasks.empty') }} &rarr; {{ h.new_value || translate.instant('tasks.empty') }}</span>
                    &middot; {{ h.changed_by?.first_name }} {{ h.changed_by?.last_name }}
                    &middot; {{ h.timestamp | date:'medium' }}
                  </span>
                </div>
              </div>
            </div>
            <ng-template #noHistory>
              <p *ngIf="historyLoaded" class="empty-message">{{ 'tasks.noHistory' | translate }}</p>
            </ng-template>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
    styles: [`
    .task-detail { max-width: 960px; }

    .detail-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px; gap: 16px;
    }
    .header-label {
      font-size: 13px; color: var(--text-secondary, #6b7280);
      display: block; margin-bottom: 4px;
    }
    .task-title {
      font-size: 22px; font-weight: 700; margin: 0;
      color: var(--text-primary, #1a1a1a);
    }
    .header-right { display: flex; gap: 12px; align-items: center; flex-shrink: 0; }
    .status-badge { font-size: 13px; }
    .edit-btn {
      text-decoration: none; font-size: 13px; padding: 8px 16px;
    }

    .meta-row {
      display: flex; flex-wrap: wrap; gap: 20px;
      padding: 20px; background: #fff;
      border-radius: var(--border-radius-card, 12px);
      border: 1px solid var(--border-color, #e5e7eb);
      margin-bottom: 16px;
    }
    .meta-item { display: flex; gap: 8px; align-items: flex-start; }
    .meta-icon { color: #9ca3af; font-size: 20px; width: 20px; height: 20px; margin-top: 2px; }
    .meta-label { display: block; font-size: 12px; color: var(--text-secondary, #6b7280); }
    .meta-value { display: block; font-size: 14px; font-weight: 500; }
    .mini-tag { font-size: 11px; margin: 2px; }
    .assignee-flex { display: flex; flex-wrap: wrap; gap: 6px; }
    .assignee-pill {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 13px;
    }
    .mini-avatar {
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--primary-blue, #1a7cf4); color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 600;
    }
    .priority-tag { margin-bottom: 16px; }

    .description-section { margin-bottom: 24px; }
    .description-section h3 { margin: 0 0 12px 0; font-size: 16px; font-weight: 600; }
    .description-text {
      white-space: pre-wrap; line-height: 1.7; color: var(--text-primary, #1a1a1a);
      margin: 0;
    }

    .tab-content { padding: 16px 0; }
    .upload-row { margin-bottom: 12px; }
    .empty-message { color: #9ca3af; padding: 16px 0; }

    .attachment-list, .history-list { display: flex; flex-direction: column; gap: 8px; }
    .attachment-item, .history-item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px; background: #fff;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 8px;
    }
    .file-icon, .history-icon { color: #9ca3af; }
    .attachment-info, .history-info { flex: 1; }
    .attachment-name {
      display: block; color: var(--primary-blue, #1a7cf4);
      text-decoration: none; font-weight: 500;
    }
    .attachment-name:hover { text-decoration: underline; }
    .attachment-meta, .history-detail { font-size: 12px; color: var(--text-secondary, #6b7280); }
    .history-action { display: block; font-weight: 500; font-size: 14px; }
    .history-detail { display: block; }
    .delete-btn {
      background: none; border: none; cursor: pointer;
      color: #ef4444; padding: 4px; border-radius: 4px;
    }
    .delete-btn:hover { background: #fef2f2; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskDetailComponent implements OnInit, OnDestroy {
  task: TaskDetail | null = null;
  isManager = false;
  canEdit = false;
  canViewHistory = false;
  attachments: any[] = [];
  history: any[] = [];
  historyLoaded = false;
  historyLoading = false;
  uploading = false;
  private taskId!: number;
  private destroy$ = new Subject<void>();
  private readonly historyTabIndex = 2;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private route: ActivatedRoute,
    private taskService: TaskService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
    this.canViewHistory = this.authService.hasAnyRole('manager', 'engineer');
    this.taskId = +this.route.snapshot.params['id'];
    this.taskService.get(this.taskId).pipe(takeUntil(this.destroy$)).subscribe((task) => {
      this.task = task;
      const currentUserId = this.authService.getCurrentUser()?.id;
      this.canEdit = this.isManager || (
        this.authService.hasRole('engineer') &&
        task.assignees.some(a => a.id == currentUserId)
      );
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
    return this.translate.instant(STATUS_TRANSLATION_KEYS[status] || status);
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
        const msg = err.error?.detail || this.translate.instant('tasks.failedChangeStatus');
        this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 3000 });
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
