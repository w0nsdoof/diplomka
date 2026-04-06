import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { GeneratedTask, UserBrief, TagBrief, ConfirmTasksResponse } from '../../../../core/models/hierarchy.models';
import { ProjectService } from '../../../../core/services/project.service';

export interface AiTaskPreviewDialogData {
  tasks: GeneratedTask[];
  warnings: string[];
  teamMembers: UserBrief[];
  tags: TagBrief[];
  epicId: number;
}

@Component({
  selector: 'app-ai-task-preview-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule,
    MatSnackBarModule, TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'epics.previewTitle' | translate }}</h2>
    <mat-dialog-content class="preview-content">
      <div *ngIf="data.warnings?.length" class="warnings-box">
        <mat-icon class="warn-icon">warning</mat-icon>
        <ul>
          <li *ngFor="let w of data.warnings">{{ w }}</li>
        </ul>
      </div>
      <div *ngFor="let task of tasks; let i = index" class="task-row">
        <div class="task-header">
          <span class="task-number">#{{ i + 1 }}</span>
          <button mat-icon-button color="warn" (click)="removeTask(i)" class="remove-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'tasks.taskTitle' | translate }}</mat-label>
          <input matInput [(ngModel)]="task.title" required />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'tasks.description' | translate }}</mat-label>
          <textarea matInput [(ngModel)]="task.description" rows="2"></textarea>
        </mat-form-field>

        <div class="task-meta-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tasks.priority' | translate }}</mat-label>
            <mat-select [(ngModel)]="task.priority">
              <mat-option value="low">{{ 'priorities.low' | translate }}</mat-option>
              <mat-option value="medium">{{ 'priorities.medium' | translate }}</mat-option>
              <mat-option value="high">{{ 'priorities.high' | translate }}</mat-option>
              <mat-option value="critical">{{ 'priorities.critical' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'projects.assignee' | translate }}</mat-label>
            <mat-select [(ngModel)]="task.assignee_id">
              <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
              <mat-option *ngFor="let m of data.teamMembers" [value]="m.id">
                {{ m.first_name }} {{ m.last_name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'tasks.tags' | translate }}</mat-label>
            <mat-select [(ngModel)]="task.tag_ids" multiple>
              <mat-option *ngFor="let t of data.tags" [value]="t.id">{{ t.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="estimate-field">
            <mat-label>{{ 'tasks.estimatedHours' | translate }}</mat-label>
            <input matInput type="number" [(ngModel)]="task.estimated_hours" min="0" step="0.5" />
            <span matSuffix>h</span>
          </mat-form-field>
        </div>
      </div>

      <p *ngIf="tasks.length === 0" class="empty-msg">{{ 'epics.noTasksToConfirm' | translate }}</p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'common.cancel' | translate }}</button>
      <button mat-flat-button color="primary" (click)="onConfirm()" [disabled]="tasks.length === 0 || confirming">
        {{ confirming ? ('common.loading' | translate) : ('epics.confirmTasks' | translate) }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .preview-content {
      max-height: 70vh;
      overflow-y: auto;
      min-width: 700px;
    }
    .task-row {
      padding: 16px;
      margin-bottom: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #fafafa;
    }
    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .task-number {
      font-weight: 600;
      font-size: 14px;
      color: #6b7280;
    }
    .remove-btn { margin: -8px -8px 0 0; }
    .full-width { width: 100%; }
    .task-meta-row {
      display: flex;
      gap: 12px;
    }
    .task-meta-row mat-form-field { flex: 1; }
    .estimate-field { max-width: 120px; }
    .warnings-box {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      color: #9a3412;
      font-size: 13px;
    }
    .warnings-box ul { margin: 0; padding-left: 16px; }
    .warnings-box li { margin-bottom: 2px; }
    .warn-icon { color: #f59e0b; font-size: 20px; margin-top: 2px; }
    .empty-msg {
      color: #9ca3af;
      text-align: center;
      padding: 32px 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiTaskPreviewDialogComponent {
  tasks: GeneratedTask[];
  confirming = false;

  constructor(
    public dialogRef: MatDialogRef<AiTaskPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AiTaskPreviewDialogData,
    private projectService: ProjectService,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {
    // Deep copy to avoid mutating original data
    this.tasks = data.tasks.map(t => ({ ...t, tag_ids: [...t.tag_ids], estimated_hours: t.estimated_hours ?? null }));
  }

  removeTask(index: number): void {
    this.tasks.splice(index, 1);
    this.cdr.markForCheck();
  }

  onConfirm(): void {
    if (this.tasks.length === 0 || this.confirming) return;
    this.confirming = true;
    this.cdr.markForCheck();

    this.projectService.confirmEpicTasks(this.data.epicId, this.tasks).subscribe({
      next: (result: ConfirmTasksResponse) => {
        this.snackBar.open(
          this.translate.instant('epics.tasksCreated', { count: result.created_count }),
          this.translate.instant('common.close'),
          { duration: 3000 },
        );
        this.dialogRef.close(result);
      },
      error: () => {
        this.confirming = false;
        this.snackBar.open(
          this.translate.instant('errors.unexpected'),
          this.translate.instant('common.close'),
          { duration: 3000 },
        );
        this.cdr.markForCheck();
      },
    });
  }
}
