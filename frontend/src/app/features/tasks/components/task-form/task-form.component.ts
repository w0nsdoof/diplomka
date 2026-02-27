import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { TaskService, TaskCreatePayload } from '../../../../core/services/task.service';
import { ClientService, Client } from '../../../../core/services/client.service';
import { TagService, Tag } from '../../../../core/services/tag.service';
import { AuthService } from '../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';

interface UserOption {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatChipsModule, MatIconModule, MatCardModule, TranslateModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>{{ (isEdit ? 'tasks.editTask' : 'tasks.createTask') | translate }}</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="taskForm" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'tasks.taskTitle' | translate }}</mat-label>
            <input matInput formControlName="title" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'tasks.description' | translate }}</mat-label>
            <textarea matInput formControlName="description" rows="5"></textarea>
          </mat-form-field>

          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'tasks.priority' | translate }}</mat-label>
              <mat-select formControlName="priority">
                <mat-option value="low">{{ 'priorities.low' | translate }}</mat-option>
                <mat-option value="medium">{{ 'priorities.medium' | translate }}</mat-option>
                <mat-option value="high">{{ 'priorities.high' | translate }}</mat-option>
                <mat-option value="critical">{{ 'priorities.critical' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'tasks.deadline' | translate }}</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="deadline" />
              <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
          </div>

          <mat-form-field *ngIf="isManager" appearance="outline" class="full-width">
            <mat-label>{{ 'tasks.assignees' | translate }}</mat-label>
            <mat-select formControlName="assignee_ids" multiple (openedChange)="onAssigneeDropdownToggle($event)">
              <div class="select-search">
                <input class="select-search-input" [placeholder]="'tasks.searchEngineers' | translate"
                       (keydown)="$event.stopPropagation()"
                       (input)="filterEngineers($any($event.target).value)" />
              </div>
              <mat-option *ngFor="let u of filteredEngineers" [value]="u.id">
                {{ u.first_name }} {{ u.last_name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field *ngIf="isManager" appearance="outline" class="full-width">
            <mat-label>{{ 'tasks.client' | translate }}</mat-label>
            <mat-select formControlName="client_id">
              <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
              <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'tasks.tags' | translate }}</mat-label>
            <mat-select formControlName="tag_ids" multiple>
              <mat-option *ngFor="let t of tags" [value]="t.id">{{ t.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="actions">
            <button mat-button type="button" (click)="cancel()">{{ 'common.cancel' | translate }}</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="taskForm.invalid || saving">
              {{ (isEdit ? 'common.update' : 'common.create') | translate }}
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .full-width { width: 100%; }
    .row { display: flex; gap: 16px; }
    .row mat-form-field { flex: 1; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    ::ng-deep .select-search {
      position: sticky; top: 0; z-index: 1;
      padding: 8px; background: white;
      border-bottom: 1px solid #e0e0e0;
    }
    ::ng-deep .select-search-input {
      width: 100%; padding: 8px; border: 1px solid #ccc;
      border-radius: 4px; font-size: 14px; outline: none; box-sizing: border-box;
    }
    ::ng-deep .select-search-input:focus { border-color: #3f51b5; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskFormComponent implements OnInit, OnDestroy {
  taskForm!: FormGroup;
  isEdit = false;
  saving = false;
  taskId: number | null = null;
  isManager = false;
  clients: Client[] = [];
  tags: Tag[] = [];
  engineers: UserOption[] = [];
  filteredEngineers: UserOption[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private taskService: TaskService,
    private clientService: ClientService,
    private tagService: TagService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');

    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      priority: ['medium', Validators.required],
      deadline: ['', Validators.required],
      assignee_ids: [[]],
      client_id: [null],
      tag_ids: [[]],
    });

    if (this.isManager) {
      this.http.get<any>(`${environment.apiUrl}/users/`, { params: { role: 'engineer', is_active: 'true', page_size: '100' } })
        .pipe(takeUntil(this.destroy$)).subscribe((res) => {
          this.engineers = res.results;
          this.filteredEngineers = res.results;
          this.cdr.markForCheck();
        });
      this.clientService.list({ page_size: 100 } as any).pipe(takeUntil(this.destroy$)).subscribe((res) => {
        this.clients = res.results;
        this.cdr.markForCheck();
      });
    }
    this.tagService.list().pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.tags = res.results;
      this.cdr.markForCheck();
    });

    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEdit = true;
      this.taskId = +id;
      this.taskService.get(this.taskId).pipe(takeUntil(this.destroy$)).subscribe((task) => {
        this.taskForm.patchValue({
          title: task.title,
          description: task.description,
          priority: task.priority,
          deadline: new Date(task.deadline),
          assignee_ids: task.assignees.map((a) => a.id),
          client_id: task.client?.id || null,
          tag_ids: task.tags.map((t) => t.id),
        });
        this.cdr.markForCheck();
      });
    }
  }

  onSubmit(): void {
    if (this.taskForm.invalid || this.saving) return;
    this.saving = true;
    const val = this.taskForm.value;
    const payload: TaskCreatePayload = {
      ...val,
      deadline: new Date(val.deadline).toISOString(),
    };

    if (this.isEdit && this.taskId) {
      const assigneeIds: number[] = val.assignee_ids || [];
      const { assignee_ids, ...updatePayload } = payload;
      this.taskService.update(this.taskId, updatePayload).pipe(takeUntil(this.destroy$)).subscribe(() => {
        if (this.isManager) {
          this.taskService.assign(this.taskId!, assigneeIds).pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.router.navigate(['/tasks']);
          });
        } else {
          this.router.navigate(['/tasks']);
        }
      });
    } else {
      this.taskService.create(payload).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.router.navigate(['/tasks']);
      });
    }
  }

  filterEngineers(query: string): void {
    const q = query.toLowerCase().trim();
    this.filteredEngineers = q
      ? this.engineers.filter((u) =>
          `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : [...this.engineers];
  }

  onAssigneeDropdownToggle(opened: boolean): void {
    if (!opened) {
      this.filteredEngineers = [...this.engineers];
    }
  }

  cancel(): void {
    this.router.navigate(['/tasks']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
