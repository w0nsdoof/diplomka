import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import { CommentService, Comment as TaskComment } from '../../../../core/services/comment.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-comment-section',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatListModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatSlideToggleModule, MatIconModule,
  ],
  template: `
    <div class="comment-section">
      <h3>Comments</h3>

      <div *ngIf="canComment" class="comment-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Add a comment (use &#64;Name to mention)</mat-label>
          <textarea matInput [(ngModel)]="newComment" rows="3"></textarea>
        </mat-form-field>
        <div class="comment-actions">
          <mat-slide-toggle *ngIf="isManager" [(ngModel)]="isPublic">Public</mat-slide-toggle>
          <button mat-raised-button color="primary" (click)="submitComment()" [disabled]="!newComment.trim()">
            <mat-icon>send</mat-icon> Post
          </button>
        </div>
      </div>

      <mat-list>
        <mat-list-item *ngFor="let comment of comments" class="comment-item">
          <div class="comment-header">
            <strong>{{ comment.author.first_name }} {{ comment.author.last_name }}</strong>
            <span class="role-badge">{{ comment.author.role }}</span>
            <span *ngIf="!comment.is_public" class="private-badge">Private</span>
            <span class="date">{{ comment.created_at | date:'medium' }}</span>
          </div>
          <p class="comment-content">{{ comment.content }}</p>
          <div *ngIf="comment.mentions.length" class="mentions">
            Mentions: <span *ngFor="let m of comment.mentions; let last = last">
              {{ m.first_name }} {{ m.last_name }}<span *ngIf="!last">, </span>
            </span>
          </div>
        </mat-list-item>
      </mat-list>
    </div>
  `,
  styles: [`
    .comment-section { margin-top: 24px; }
    .comment-form { margin-bottom: 16px; }
    .full-width { width: 100%; }
    .comment-actions { display: flex; justify-content: space-between; align-items: center; }
    .comment-header { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
    .role-badge { font-size: 12px; background: #e0e0e0; padding: 2px 8px; border-radius: 4px; }
    .private-badge { font-size: 12px; background: #ffcdd2; padding: 2px 8px; border-radius: 4px; }
    .date { font-size: 12px; color: #757575; margin-left: auto; }
    .comment-content { margin: 4px 0; }
    .mentions { font-size: 12px; color: #1976d2; }
    .comment-item { height: auto !important; margin-bottom: 12px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentSectionComponent implements OnInit, OnDestroy {
  @Input() taskId!: number;
  comments: TaskComment[] = [];
  newComment = '';
  isPublic = true;
  canComment = false;
  isManager = false;
  private destroy$ = new Subject<void>();

  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
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

  submitComment(): void {
    if (!this.newComment.trim()) return;
    this.commentService.create(this.taskId, this.newComment, this.isPublic).pipe(takeUntil(this.destroy$)).subscribe((comment) => {
      this.comments.push(comment);
      this.newComment = '';
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
