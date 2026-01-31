import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { TaskService, TaskDetail } from '../../../../core/services/task.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatCardModule, MatChipsModule,
    MatButtonModule, MatIconModule, MatListModule, MatDividerModule,
    MatTabsModule,
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
        <mat-chip [class]="'status-' + task.status">{{ task.status }}</mat-chip>
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

      <mat-tab-group>
        <mat-tab label="Attachments ({{ task.attachments?.length || 0 }})">
          <mat-list>
            <mat-list-item *ngFor="let a of task.attachments">
              <mat-icon matListItemIcon>attach_file</mat-icon>
              <span matListItemTitle>{{ a.filename || a.original_filename }}</span>
              <span matListItemLine>{{ a.file_size | number }} bytes</span>
            </mat-list-item>
          </mat-list>
        </mat-tab>
        <mat-tab label="History">
          <mat-list>
            <mat-list-item *ngFor="let h of task.history">
              <span matListItemTitle>{{ h.action }}: {{ h.field_name || '' }}</span>
              <span matListItemLine>{{ h.old_value }} -> {{ h.new_value }} ({{ h.timestamp | date:'medium' }})</span>
            </mat-list-item>
          </mat-list>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; }
    .meta { display: flex; gap: 12px; align-items: center; margin: 16px 0; flex-wrap: wrap; }
    .description-card { margin: 16px 0; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin: 16px 0; }
  `],
})
export class TaskDetailComponent implements OnInit {
  task: TaskDetail | null = null;
  isManager = false;

  constructor(
    private route: ActivatedRoute,
    private taskService: TaskService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
    const id = +this.route.snapshot.params['id'];
    this.taskService.get(id).subscribe((task) => (this.task = task));
  }
}
