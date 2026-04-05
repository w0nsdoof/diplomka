import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, interval, switchMap, takeUntil, takeWhile } from 'rxjs';
import { ProjectService } from '../../../../core/services/project.service';
import { ClientService, Client } from '../../../../core/services/client.service';
import { TagService, Tag } from '../../../../core/services/tag.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EpicDetail, EpicUpdatePayload, ProjectListItem, ParentContext, UserBrief, TagBrief } from '../../../../core/models/hierarchy.models';
import { AiTaskPreviewDialogComponent, AiTaskPreviewDialogData } from '../ai-task-preview/ai-task-preview-dialog.component';
import { STATUS_TRANSLATION_KEYS } from '../../../../core/constants/task-status';
import { CreateEntityDialogComponent } from '../../../tasks/components/create-dialog/create-entity-dialog.component';
import { ParentBreadcrumbComponent, BreadcrumbItem } from '../../../../shared/components/parent-breadcrumb/parent-breadcrumb.component';
import { environment } from '../../../../../environments/environment';

interface UserOption {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

const ALL_STATUSES = ['created', 'in_progress', 'waiting', 'done', 'archived'];

@Component({
  selector: 'app-epic-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule, MatCardModule, MatChipsModule,
    MatButtonModule, MatIconModule, MatDividerModule, MatTabsModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatMenuModule, MatSnackBarModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, TranslateModule,
    ParentBreadcrumbComponent,
  ],
  template: `
    <div *ngIf="epic" class="epic-detail">
      <!-- Breadcrumb -->
      <app-parent-breadcrumb [items]="breadcrumbItems"></app-parent-breadcrumb>

      <!-- Header -->
      <div class="detail-header">
        <div class="header-left">
          <a *ngIf="epic.project" [routerLink]="['/projects', epic.project.id]" class="back-link">
            <mat-icon>arrow_back</mat-icon> {{ epic.project.title }}
          </a>
          <a *ngIf="!epic.project" routerLink="/projects" class="back-link">
            <mat-icon>arrow_back</mat-icon> {{ 'projects.title' | translate }}
          </a>
          <h2 class="epic-title" *ngIf="!editMode">{{ epic.title }}</h2>
        </div>
        <div class="header-right">
          <mat-chip [class]="'status-' + epic.status"
                    [matMenuTriggerFor]="isManager ? statusMenu : null"
                    [style.cursor]="isManager ? 'pointer' : 'default'"
                    class="status-badge">
            {{ statusLabel(epic.status) }}
            <mat-icon *ngIf="isManager" iconPositionEnd style="font-size:18px;width:18px;height:18px">arrow_drop_down</mat-icon>
          </mat-chip>
          <mat-menu #statusMenu="matMenu">
            <button mat-menu-item *ngFor="let s of getAvailableStatuses(epic.status)" (click)="onChangeStatus(s)">
              {{ statusLabel(s) }}
            </button>
          </mat-menu>
          <button class="flat-btn-primary" *ngIf="canEdit && !editMode" (click)="enterEditMode()">
            <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
          </button>
          <button class="flat-btn-outline" *ngIf="editMode" (click)="cancelEdit()">
            {{ 'common.cancel' | translate }}
          </button>
          <button class="flat-btn-primary" *ngIf="editMode" (click)="saveEdit()" [disabled]="editForm.invalid || saving">
            {{ 'common.save' | translate }}
          </button>
        </div>
      </div>

      <!-- Edit form -->
      <div *ngIf="editMode" class="edit-section flat-card">
        <form [formGroup]="editForm">
          <div class="form-group">
            <label class="flat-input-label">{{ 'tasks.taskTitle' | translate }}</label>
            <input class="flat-input" formControlName="title" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'tasks.description' | translate }}</label>
            <textarea class="flat-input textarea" formControlName="description" rows="4"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="flat-input-label">{{ 'tasks.priority' | translate }}</label>
              <mat-form-field appearance="outline" class="full-width">
                <mat-select formControlName="priority">
                  <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
                  <mat-option value="low">{{ 'priorities.low' | translate }}</mat-option>
                  <mat-option value="medium">{{ 'priorities.medium' | translate }}</mat-option>
                  <mat-option value="high">{{ 'priorities.high' | translate }}</mat-option>
                  <mat-option value="critical">{{ 'priorities.critical' | translate }}</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="form-group">
              <label class="flat-input-label">{{ 'tasks.deadline' | translate }}</label>
              <mat-form-field appearance="outline" class="full-width">
                <input matInput [matDatepicker]="picker" formControlName="deadline" />
                <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker></mat-datepicker>
              </mat-form-field>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" *ngIf="isManager">
              <label class="flat-input-label">{{ 'epics.project' | translate }}</label>
              <mat-form-field appearance="outline" class="full-width">
                <mat-select formControlName="project_id">
                  <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
                  <mat-option *ngFor="let p of projects" [value]="p.id">{{ p.title }}</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="form-group">
              <label class="flat-input-label">{{ 'projects.assignee' | translate }}</label>
              <mat-form-field appearance="outline" class="full-width">
                <mat-select formControlName="assignee_id">
                  <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
                  <mat-option *ngFor="let u of users" [value]="u.id">
                    {{ u.first_name }} {{ u.last_name }}
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>
          <div class="form-row" *ngIf="isManager">
            <div class="form-group">
              <label class="flat-input-label">{{ 'tasks.client' | translate }}</label>
              <mat-form-field appearance="outline" class="full-width">
                <mat-select formControlName="client_id">
                  <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
                  <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <div class="form-group">
              <label class="flat-input-label">{{ 'tasks.tags' | translate }}</label>
              <mat-form-field appearance="outline" class="full-width">
                <mat-select formControlName="tag_ids" multiple>
                  <mat-option *ngFor="let t of tags" [value]="t.id">{{ t.name }}</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>
        </form>
      </div>

      <!-- Read-only view -->
      <ng-container *ngIf="!editMode">
        <!-- Metadata row -->
        <div class="meta-row">
          <div class="meta-item">
            <mat-icon class="meta-icon">calendar_today</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.createdAt' | translate }}</span>
              <span class="meta-value">{{ epic.created_at | date:'mediumDate' }}</span>
            </div>
          </div>
          <div class="meta-item" *ngIf="epic.priority">
            <mat-icon class="meta-icon">flag</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.priority' | translate }}</span>
              <span class="meta-value">
                <mat-chip [class]="'priority-' + epic.priority">{{ 'priorities.' + epic.priority | translate }}</mat-chip>
              </span>
            </div>
          </div>
          <div class="meta-item" *ngIf="epic.deadline">
            <mat-icon class="meta-icon">event</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.deadline' | translate }}</span>
              <span class="meta-value">{{ epic.deadline | date:'mediumDate' }}</span>
            </div>
          </div>
          <div class="meta-item" *ngIf="epic.project">
            <mat-icon class="meta-icon">folder</mat-icon>
            <div>
              <span class="meta-label">{{ 'epics.project' | translate }}</span>
              <span class="meta-value">
                <a [routerLink]="['/projects', epic.project.id]" class="parent-link">{{ epic.project.title }}</a>
              </span>
            </div>
          </div>
          <div class="meta-item" *ngIf="epic.client">
            <mat-icon class="meta-icon">apartment</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.client' | translate }}</span>
              <span class="meta-value">{{ epic.client.name }}</span>
            </div>
          </div>
          <div class="meta-item">
            <mat-icon class="meta-icon">person</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.createdBy' | translate }}</span>
              <span class="meta-value">{{ epic.created_by?.first_name }} {{ epic.created_by?.last_name }}</span>
            </div>
          </div>
          <div class="meta-item" *ngIf="epic.assignee">
            <mat-icon class="meta-icon">assignment_ind</mat-icon>
            <div>
              <span class="meta-label">{{ 'projects.assignee' | translate }}</span>
              <span class="meta-value assignee-flex">
                <span class="assignee-pill">
                  <span class="mini-avatar">{{ epic.assignee.first_name?.charAt(0) || '' }}</span>
                  {{ epic.assignee.first_name }} {{ epic.assignee.last_name }}
                </span>
              </span>
            </div>
          </div>
          <div class="meta-item" *ngIf="epic.tags.length">
            <mat-icon class="meta-icon">label</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.tags' | translate }}</span>
              <span class="meta-value">
                <mat-chip *ngFor="let t of epic.tags" class="mini-tag">{{ t.name }}</mat-chip>
              </span>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="description-section flat-card" *ngIf="epic.description">
          <h3>{{ 'tasks.description' | translate }}</h3>
          <p class="description-text">{{ epic.description }}</p>
        </div>
      </ng-container>

      <!-- Tabs: Tasks & History -->
      <mat-tab-group (selectedTabChange)="onTabChange($event)">
        <mat-tab [label]="translate.instant('epics.tasks') + ' (' + tasks.length + ')'">
          <div class="tab-content">
            <div class="tab-header">
              <button class="flat-btn-primary" *ngIf="canEdit" (click)="openAddTaskDialog()">
                <mat-icon>add</mat-icon> {{ 'epics.addTask' | translate }}
              </button>
              <button class="flat-btn-outline" *ngIf="isManager && !isGenerating"
                      (click)="onGenerateTasks()"
                      [disabled]="!epic?.title || !epic?.description">
                <mat-icon>auto_awesome</mat-icon> {{ 'epics.generateTasks' | translate }}
              </button>
              <span *ngIf="isGenerating" class="generating-indicator">
                <mat-spinner diameter="20"></mat-spinner>
                <span>{{ 'epics.generating' | translate }}</span>
              </span>
            </div>
            <div *ngIf="tasks.length; else noTasks" class="child-list">
              <div *ngFor="let task of tasks" class="child-item">
                <div class="child-main">
                  <a [routerLink]="['/tasks', task.id]" class="child-link">{{ task.title }}</a>
                  <mat-chip [class]="'status-' + task.status" class="child-status">
                    {{ statusLabel(task.status) }}
                  </mat-chip>
                </div>
                <div class="child-meta">
                  <span *ngIf="task.priority">
                    <mat-chip [class]="'priority-' + task.priority" class="mini-chip">
                      {{ 'priorities.' + task.priority | translate }}
                    </mat-chip>
                  </span>
                  <span *ngIf="task.assignees?.length" class="child-assignee">
                    {{ task.assignees[0].first_name }} {{ task.assignees[0].last_name }}
                    <span *ngIf="task.assignees.length > 1"> +{{ task.assignees.length - 1 }}</span>
                  </span>
                  <span *ngIf="task.deadline" class="child-deadline">
                    {{ task.deadline | date:'mediumDate' }}
                  </span>
                </div>
              </div>
            </div>
            <ng-template #noTasks>
              <p class="empty-message">{{ 'epics.noTasks' | translate }}</p>
            </ng-template>
          </div>
        </mat-tab>
        <mat-tab [label]="translate.instant('tasks.history')">
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
    .epic-detail { max-width: 960px; }

    .detail-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px; gap: 16px;
    }
    .header-left { display: flex; flex-direction: column; gap: 4px; }
    .back-link {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 13px; color: var(--text-secondary, #6b7280);
      text-decoration: none; margin-bottom: 4px;
    }
    .back-link:hover { color: var(--primary-blue, #1a7cf4); }
    .epic-title {
      font-size: 22px; font-weight: 700; margin: 0;
      color: var(--text-primary, #1a1a1a);
    }
    .header-right { display: flex; gap: 12px; align-items: center; flex-shrink: 0; }
    .status-badge { font-size: 13px; }

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
    .parent-link { color: var(--primary-blue, #1a7cf4); text-decoration: none; }
    .parent-link:hover { text-decoration: underline; }
    .assignee-flex { display: flex; flex-wrap: wrap; gap: 6px; }
    .assignee-pill {
      display: inline-flex; align-items: center; gap: 4px; font-size: 13px;
    }
    .mini-avatar {
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--primary-blue, #1a7cf4); color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 600;
    }

    .description-section { margin-bottom: 24px; }
    .description-section h3 { margin: 0 0 12px 0; font-size: 16px; font-weight: 600; }
    .description-text {
      white-space: pre-wrap; line-height: 1.7; color: var(--text-primary, #1a1a1a); margin: 0;
    }

    /* Edit form */
    .edit-section { margin-bottom: 24px; }
    .form-group { margin-bottom: 20px; }
    .textarea { resize: vertical; min-height: 80px; }
    .form-row { display: flex; gap: 16px; }
    .form-row .form-group { flex: 1; }
    .full-width { width: 100%; }

    /* Tab content */
    .tab-content { padding: 16px 0; }
    .tab-header { margin-bottom: 12px; display: flex; gap: 12px; align-items: center; }
    .generating-indicator {
      display: inline-flex; align-items: center; gap: 8px;
      font-size: 13px; color: var(--text-secondary, #6b7280);
    }
    .empty-message { color: #9ca3af; padding: 16px 0; }

    /* Child list (tasks) */
    .child-list { display: flex; flex-direction: column; gap: 8px; }
    .child-item {
      padding: 14px 16px; background: #fff;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 8px;
    }
    .child-main { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
    .child-link {
      font-weight: 500; color: var(--primary-blue, #1a7cf4);
      text-decoration: none; font-size: 14px;
    }
    .child-link:hover { text-decoration: underline; }
    .child-status { font-size: 11px; }
    .child-meta { display: flex; gap: 16px; align-items: center; font-size: 12px; color: var(--text-secondary, #6b7280); }
    .child-assignee, .child-deadline { white-space: nowrap; }
    .mini-chip { font-size: 10px; min-height: 20px; padding: 1px 6px; }

    /* History */
    .history-list { display: flex; flex-direction: column; gap: 8px; }
    .history-item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px; background: #fff;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 8px;
    }
    .history-icon { color: #9ca3af; }
    .history-info { flex: 1; }
    .history-action { display: block; font-weight: 500; font-size: 14px; }
    .history-detail { display: block; font-size: 12px; color: var(--text-secondary, #6b7280); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpicDetailComponent implements OnInit, OnDestroy {
  epic: EpicDetail | null = null;
  isManager = false;
  canEdit = false;
  editMode = false;
  saving = false;
  isGenerating = false;
  editForm!: FormGroup;

  // Tasks
  tasks: any[] = [];

  // History (lazy)
  history: any[] = [];
  historyLoaded = false;
  historyLoading = false;

  // Breadcrumb
  breadcrumbItems: BreadcrumbItem[] = [];

  // Dropdown data for edit mode
  users: UserOption[] = [];
  clients: Client[] = [];
  tags: Tag[] = [];
  projects: ProjectListItem[] = [];

  private epicId!: number;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private http: HttpClient,
    private projectService: ProjectService,
    private clientService: ClientService,
    private tagService: TagService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    public translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
    this.epicId = +this.route.snapshot.params['id'];

    this.editForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      priority: [null],
      deadline: [null],
      project_id: [null],
      assignee_id: [null],
      client_id: [null],
      tag_ids: [[]],
    });

    this.loadEpic();
    this.loadTasks();
  }

  openAddTaskDialog(): void {
    if (!this.epic) return;
    const parentContext: ParentContext = {
      parentType: 'epic',
      parentId: this.epic.id,
      projectId: this.epic.project?.id,
    };
    const dialogRef = this.dialog.open(CreateEntityDialogComponent, {
      width: '600px',
      data: parentContext,
    });
    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (result) {
        this.loadTasks();
      }
    });
  }

  onGenerateTasks(): void {
    if (!this.epic || this.isGenerating) return;
    this.isGenerating = true;
    this.cdr.markForCheck();

    this.projectService.generateEpicTasks(this.epicId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.pollGeneration(res.task_id);
      },
      error: (err) => {
        this.isGenerating = false;
        this.cdr.markForCheck();
        if (err.status === 409) {
          this.snackBar.open(
            this.translate.instant('epics.generationInProgress'),
            this.translate.instant('common.close'),
            { duration: 3000 },
          );
        } else {
          this.snackBar.open(
            this.translate.instant('epics.generationFailed'),
            this.translate.instant('common.close'),
            { duration: 4000 },
          );
        }
      },
    });
  }

  private pollGeneration(taskId: string): void {
    let pollCount = 0;
    interval(1000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => {
        pollCount++;
        // Back off to 3s interval after 10 polls
        if (pollCount > 10 && pollCount % 3 !== 0) {
          return [];
        }
        return this.projectService.pollGenerationStatus(this.epicId, taskId);
      }),
      takeWhile((status) => status.status === 'pending' || status.status === 'processing', true),
    ).subscribe({
      next: (genStatus) => {
        if (genStatus.status === 'completed' && genStatus.result) {
          this.isGenerating = false;
          this.cdr.markForCheck();
          this.openPreviewDialog(genStatus.result.tasks);
        } else if (genStatus.status === 'failed') {
          this.isGenerating = false;
          this.cdr.markForCheck();
          this.snackBar.open(
            genStatus.error || this.translate.instant('epics.generationFailed'),
            this.translate.instant('common.close'),
            { duration: 4000 },
          );
        }
      },
      error: () => {
        this.isGenerating = false;
        this.cdr.markForCheck();
      },
    });
  }

  private openPreviewDialog(tasks: any[]): void {
    // Collect team members and tags for the dialog
    const teamMembers: UserBrief[] = this.epic?.project
      ? (this.users || []).map(u => ({ id: u.id, first_name: u.first_name, last_name: u.last_name }))
      : [];
    const tagBriefs: TagBrief[] = (this.tags || []).map(t => ({ id: t.id, name: t.name, color: (t as any).color || '#6c757d' }));

    // Load team data if not already loaded
    if (teamMembers.length === 0 || tagBriefs.length === 0) {
      this.loadDropdownData();
    }

    const dialogData: AiTaskPreviewDialogData = {
      tasks,
      teamMembers: teamMembers.length > 0 ? teamMembers : [],
      tags: tagBriefs.length > 0 ? tagBriefs : [],
      epicId: this.epicId,
    };

    const dialogRef = this.dialog.open(AiTaskPreviewDialogComponent, {
      width: '800px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (result) {
        this.loadTasks();
      }
    });
  }

  loadEpic(): void {
    this.projectService.getEpic(this.epicId).pipe(takeUntil(this.destroy$)).subscribe((epic) => {
      this.epic = epic;
      this.computeCanEdit();
      this.buildBreadcrumb();
      this.cdr.markForCheck();
    });
  }

  loadTasks(): void {
    this.projectService.getEpicTasks(this.epicId).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.tasks = res.results;
      this.cdr.markForCheck();
    });
  }

  statusLabel(status: string): string {
    return this.translate.instant(STATUS_TRANSLATION_KEYS[status] || status);
  }

  getAvailableStatuses(currentStatus: string): string[] {
    return ALL_STATUSES.filter(s => s !== currentStatus);
  }

  onChangeStatus(newStatus: string): void {
    if (!this.epic) return;
    this.projectService.changeEpicStatus(this.epic.id, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.epic!.status = newStatus;
        this.cdr.markForCheck();
      },
      error: (err) => {
        const msg = err.error?.detail || this.translate.instant('projects.failedChangeStatus');
        this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 3000 });
      },
    });
  }

  enterEditMode(): void {
    if (!this.epic) return;
    this.editForm.patchValue({
      title: this.epic.title,
      description: this.epic.description,
      priority: this.epic.priority,
      deadline: this.epic.deadline ? new Date(this.epic.deadline) : null,
      project_id: this.epic.project?.id || null,
      assignee_id: this.epic.assignee?.id || null,
      client_id: this.epic.client?.id || null,
      tag_ids: this.epic.tags.map(t => t.id),
    });

    // Engineers have limited fields
    if (!this.isManager) {
      this.editForm.get('project_id')?.disable();
      this.editForm.get('client_id')?.disable();
      this.editForm.get('tag_ids')?.disable();
    } else {
      this.editForm.get('project_id')?.enable();
      this.editForm.get('client_id')?.enable();
      this.editForm.get('tag_ids')?.enable();
    }

    this.editMode = true;
    this.loadDropdownData();
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editMode = false;
    this.cdr.markForCheck();
  }

  saveEdit(): void {
    if (!this.epic || this.editForm.invalid || this.saving) return;
    this.saving = true;
    const val = this.editForm.getRawValue();
    const payload: EpicUpdatePayload = {
      version: this.epic.version,
      title: val.title,
      description: val.description,
      priority: val.priority,
      deadline: val.deadline ? new Date(val.deadline).toISOString().split('T')[0] : undefined,
      assignee_id: val.assignee_id,
    };

    // Include manager-only fields
    if (this.isManager) {
      payload.project_id = val.project_id;
      payload.client_id = val.client_id;
      payload.tag_ids = val.tag_ids;
    }

    this.projectService.updateEpic(this.epicId, payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.epic = updated;
        this.editMode = false;
        this.saving = false;
        this.computeCanEdit();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        const msg = err.error?.detail || err.error?.version?.[0] || this.translate.instant('errors.unexpected');
        this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  onTabChange(event: MatTabChangeEvent): void {
    if (event.index === 1 && !this.historyLoaded) {
      this.loadHistory();
    }
  }

  getHistoryIcon(action: string): string {
    switch (action) {
      case 'created': return 'add_circle';
      case 'updated': return 'edit';
      case 'status_changed': return 'swap_horiz';
      case 'assigned': return 'person_add';
      default: return 'history';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private computeCanEdit(): void {
    if (this.isManager) {
      this.canEdit = true;
    } else if (this.epic && this.authService.hasRole('engineer')) {
      const currentUserId = this.authService.getCurrentUser()?.id;
      this.canEdit = this.epic.assignee?.id === currentUserId;
    } else {
      this.canEdit = false;
    }
  }

  private loadHistory(): void {
    this.historyLoading = true;
    this.cdr.markForCheck();
    this.projectService.getEpicHistory(this.epicId).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.history = res.results;
      this.historyLoaded = true;
      this.historyLoading = false;
      this.cdr.markForCheck();
    });
  }

  private buildBreadcrumb(): void {
    const items: BreadcrumbItem[] = [];
    if (this.epic?.project) {
      items.push({
        label: this.epic.project.title,
        route: ['/projects', String(this.epic.project.id)],
      });
    }
    this.breadcrumbItems = items;
  }

  private loadDropdownData(): void {
    // Load users
    this.http.get<any>(`${environment.apiUrl}/users/`, { params: { is_active: 'true', page_size: '100' } })
      .pipe(takeUntil(this.destroy$)).subscribe((res) => {
        this.users = res.results;
        this.cdr.markForCheck();
      });

    if (this.isManager) {
      // Load clients
      this.clientService.list({ page_size: 100 } as any).pipe(takeUntil(this.destroy$)).subscribe((res) => {
        this.clients = res.results;
        this.cdr.markForCheck();
      });
      // Load tags
      this.tagService.list().pipe(takeUntil(this.destroy$)).subscribe((res) => {
        this.tags = res.results;
        this.cdr.markForCheck();
      });
      // Load projects for re-parenting
      this.projectService.listProjects({ page_size: 100 }).pipe(takeUntil(this.destroy$)).subscribe((res) => {
        this.projects = res.results;
        this.cdr.markForCheck();
      });
    }
  }
}
