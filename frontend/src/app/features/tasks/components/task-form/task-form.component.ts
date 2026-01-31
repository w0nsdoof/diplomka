import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { TaskService, TaskCreatePayload } from '../../../../core/services/task.service';
import { ClientService, Client } from '../../../../core/services/client.service';
import { TagService, Tag } from '../../../../core/services/tag.service';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatChipsModule, MatIconModule, MatCardModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>{{ isEdit ? 'Edit Task' : 'Create Task' }}</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="taskForm" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <textarea matInput formControlName="description" rows="5"></textarea>
          </mat-form-field>

          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Priority</mat-label>
              <mat-select formControlName="priority">
                <mat-option value="low">Low</mat-option>
                <mat-option value="medium">Medium</mat-option>
                <mat-option value="high">High</mat-option>
                <mat-option value="critical">Critical</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Deadline</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="deadline" />
              <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Client</mat-label>
            <mat-select formControlName="client_id">
              <mat-option [value]="null">None</mat-option>
              <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Tags</mat-label>
            <mat-select formControlName="tag_ids" multiple>
              <mat-option *ngFor="let t of tags" [value]="t.id">{{ t.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="actions">
            <button mat-button type="button" (click)="cancel()">Cancel</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="taskForm.invalid || saving">
              {{ isEdit ? 'Update' : 'Create' }}
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
  `],
})
export class TaskFormComponent implements OnInit {
  taskForm!: FormGroup;
  isEdit = false;
  saving = false;
  taskId: number | null = null;
  clients: Client[] = [];
  tags: Tag[] = [];

  constructor(
    private fb: FormBuilder,
    private taskService: TaskService,
    private clientService: ClientService,
    private tagService: TagService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      priority: ['medium', Validators.required],
      deadline: ['', Validators.required],
      client_id: [null],
      tag_ids: [[]],
    });

    this.clientService.list({ page_size: 100 } as any).subscribe((res) => (this.clients = res.results));
    this.tagService.list().subscribe((res) => (this.tags = res.results));

    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEdit = true;
      this.taskId = +id;
      this.taskService.get(this.taskId).subscribe((task) => {
        this.taskForm.patchValue({
          title: task.title,
          description: task.description,
          priority: task.priority,
          deadline: new Date(task.deadline),
          client_id: task.client?.id || null,
          tag_ids: task.tags.map((t) => t.id),
        });
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
      this.taskService.update(this.taskId, payload).subscribe({
        next: () => this.router.navigate(['/tasks', this.taskId]),
        error: () => (this.saving = false),
      });
    } else {
      this.taskService.create(payload).subscribe({
        next: (task) => this.router.navigate(['/tasks', task.id]),
        error: () => (this.saving = false),
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/tasks']);
  }
}
