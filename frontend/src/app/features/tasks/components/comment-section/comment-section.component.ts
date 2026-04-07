import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { CommentService, Comment as TaskComment, CommentAttachment } from '../../../../core/services/comment.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TaskService } from '../../../../core/services/task.service';

const PREVIEWABLE_MIME_PREFIXES = ['image/', 'application/pdf'];

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

@Component({
    selector: 'app-comment-section',
    imports: [
        CommonModule, FormsModule, MatListModule, MatFormFieldModule,
        MatInputModule, MatButtonModule, MatSlideToggleModule, MatIconModule,
        MatChipsModule, MatTooltipModule, TranslateModule,
    ],
    template: `
    <div class="comment-section">
      <h3>{{ 'comments.title' | translate }}</h3>

      <div *ngIf="canComment" class="comment-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'comments.placeholder' | translate }}</mat-label>
          <textarea matInput [(ngModel)]="newComment" rows="3"></textarea>
        </mat-form-field>

        <mat-chip-set *ngIf="pendingFiles.length" class="pending-files" aria-label="Selected attachments">
          <mat-chip *ngFor="let file of pendingFiles; let i = index" (removed)="removePendingFile(i)">
            <mat-icon matChipAvatar>attach_file</mat-icon>
            {{ file.name }} <span class="file-size">({{ formatBytes(file.size) }})</span>
            <button matChipRemove [attr.aria-label]="'comments.removeAttachment' | translate">
              <mat-icon>cancel</mat-icon>
            </button>
          </mat-chip>
        </mat-chip-set>

        <input
          #fileInput
          type="file"
          multiple
          hidden
          (change)="onFilesSelected($event)"
        />

        <div class="comment-actions">
          <div class="left-actions">
            <button
              mat-stroked-button
              type="button"
              (click)="fileInput.click()"
              [matTooltip]="'comments.attach' | translate"
            >
              <mat-icon>attach_file</mat-icon> {{ 'comments.attach' | translate }}
            </button>
            <mat-slide-toggle *ngIf="isManager" [(ngModel)]="isPublic">{{ 'comments.public' | translate }}</mat-slide-toggle>
          </div>
          <button
            mat-raised-button
            color="primary"
            (click)="submitComment()"
            [disabled]="(!newComment.trim() && !pendingFiles.length) || submitting"
          >
            <mat-icon>send</mat-icon> {{ 'comments.post' | translate }}
          </button>
        </div>
      </div>

      <mat-list>
        <mat-list-item *ngFor="let comment of comments" class="comment-item">
          <div class="comment-header">
            <strong>{{ comment.author.first_name }} {{ comment.author.last_name }}</strong>
            <span class="role-badge">{{ comment.author.role }}</span>
            <span *ngIf="!comment.is_public" class="private-badge">{{ 'comments.private' | translate }}</span>
            <span class="date">{{ comment.created_at | date:'medium' }}</span>
          </div>
          <p class="comment-content">{{ comment.content }}</p>
          <div *ngIf="comment.mentions.length" class="mentions">
            {{ 'comments.mentions' | translate }} <span *ngFor="let m of comment.mentions; let last = last">
              {{ m.first_name }} {{ m.last_name }}<span *ngIf="!last">, </span>
            </span>
          </div>
          <div *ngIf="comment.attachments?.length" class="comment-attachments">
            <div class="attachments-label">
              <mat-icon>attachment</mat-icon>
              <span>{{ 'comments.attachments' | translate }}</span>
            </div>
            <a
              *ngFor="let att of comment.attachments"
              href="#"
              (click)="openAttachment(att, $event)"
              class="attachment-link"
              [class.is-image]="isImage(att)"
              [matTooltip]="isPreviewable(att) ? ('comments.preview' | translate) : ('comments.download' | translate)"
            >
              <mat-icon>{{ isImage(att) ? 'image' : 'insert_drive_file' }}</mat-icon>
              {{ att.filename }}
              <span class="file-size">({{ formatBytes(att.file_size) }})</span>
            </a>
          </div>
        </mat-list-item>
      </mat-list>
    </div>
  `,
    styles: [`
    .comment-section { margin-top: 24px; }
    .comment-form { margin-bottom: 16px; }
    .full-width { width: 100%; }
    .pending-files { margin: 4px 0 12px 0; }
    .pending-files mat-chip { font-size: 12px; }
    .pending-files .file-size { color: #757575; margin-left: 4px; font-size: 11px; }
    .comment-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .left-actions { display: flex; align-items: center; gap: 12px; }
    .comment-header { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
    .role-badge { font-size: 12px; background: #e0e0e0; padding: 2px 8px; border-radius: 4px; }
    .private-badge { font-size: 12px; background: #ffcdd2; padding: 2px 8px; border-radius: 4px; }
    .date { font-size: 12px; color: #757575; margin-left: auto; }
    .comment-content { margin: 4px 0; white-space: pre-wrap; }
    .mentions { font-size: 12px; color: #1976d2; }
    .comment-item { height: auto !important; margin-bottom: 12px; }
    .comment-attachments { margin-top: 8px; padding: 8px 12px; background: #f5f5f5; border-radius: 6px; }
    .attachments-label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #616161; margin-bottom: 4px; }
    .attachments-label mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .attachment-link { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; margin: 2px 6px 2px 0; background: white; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 13px; color: #1976d2; text-decoration: none; }
    .attachment-link:hover { background: #e3f2fd; }
    .attachment-link mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .attachment-link .file-size { color: #757575; font-size: 11px; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommentSectionComponent implements OnInit, OnDestroy {
  @Input() taskId!: number;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  comments: TaskComment[] = [];
  newComment = '';
  isPublic = true;
  canComment = false;
  isManager = false;
  pendingFiles: File[] = [];
  submitting = false;
  private destroy$ = new Subject<void>();

  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private taskService: TaskService,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.canComment = user?.role !== 'client';
    this.isManager = user?.role === 'manager';
    this.loadComments();
  }

  loadComments(): void {
    this.commentService.list(this.taskId).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.comments = res.results;
      this.cdr.markForCheck();
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const accepted: File[] = [];
    for (let i = 0; i < input.files.length; i++) {
      const f = input.files.item(i)!;
      if (f.size > MAX_ATTACHMENT_BYTES) {
        const msg = this.translate.instant('comments.attachmentTooLarge', { name: f.name });
        this.snackBar.open(msg, 'OK', { duration: 4000 });
        continue;
      }
      accepted.push(f);
    }
    this.pendingFiles = [...this.pendingFiles, ...accepted];
    // Reset the input so re-selecting the same file fires change.
    input.value = '';
    this.cdr.markForCheck();
  }

  removePendingFile(index: number): void {
    this.pendingFiles = this.pendingFiles.filter((_, i) => i !== index);
    this.cdr.markForCheck();
  }

  submitComment(): void {
    if (!this.newComment.trim() && !this.pendingFiles.length) return;
    this.submitting = true;
    this.commentService
      .create(this.taskId, this.newComment, this.isPublic, this.pendingFiles)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (comment) => {
          this.comments.unshift(comment);
          this.newComment = '';
          this.pendingFiles = [];
          this.submitting = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.submitting = false;
          this.cdr.markForCheck();
        },
      });
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  isImage(att: CommentAttachment): boolean {
    return att.content_type?.startsWith('image/') ?? false;
  }

  isPreviewable(att: CommentAttachment): boolean {
    const ct = att.content_type ?? '';
    return PREVIEWABLE_MIME_PREFIXES.some((p) => ct.startsWith(p));
  }

  openAttachment(att: CommentAttachment, event: Event): void {
    event.preventDefault();
    // The download URL requires JWT auth, which the browser would not send on a
    // raw <a href> click. Fetch through the interceptor-aware service so the
    // token is attached, then either preview (images, PDFs) or trigger a save.
    this.taskService
      .downloadAttachment(this.taskId, att.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          // Wrap in a typed Blob so the browser uses our content_type, not
          // the application/octet-stream the backend sets for downloads.
          const typed = new Blob([blob], { type: att.content_type || 'application/octet-stream' });
          const url = URL.createObjectURL(typed);
          if (this.isPreviewable(att)) {
            window.open(url, '_blank', 'noopener');
            // Give the new tab time to fetch the blob before revoking.
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
          } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = att.filename;
            a.click();
            URL.revokeObjectURL(url);
          }
        },
        error: () => {
          this.snackBar.open(
            this.translate.instant('comments.downloadFailed'),
            'OK',
            { duration: 4000 },
          );
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
