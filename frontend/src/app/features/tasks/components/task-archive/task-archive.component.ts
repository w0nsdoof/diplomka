import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { TaskService, TaskListItem, TaskFilters } from '../../../../core/services/task.service';
import { SearchBarComponent } from '../../../../shared/components/search-bar/search-bar.component';

@Component({
  selector: 'app-task-archive',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatTableModule, MatChipsModule,
    MatPaginatorModule, MatIconModule, SearchBarComponent, TranslateModule,
  ],
  template: `
    <div class="archive-header">
      <h2>{{ 'nav.archive' | translate }}</h2>
    </div>

    <app-search-bar [placeholder]="'tasks.searchArchived' | translate" (search)="onSearch($event)"></app-search-bar>

    <table mat-table [dataSource]="tasks" class="full-width">
      <ng-container matColumnDef="title">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.taskTitle' | translate }}</th>
        <td mat-cell *matCellDef="let task">
          <a [routerLink]="['/tasks', task.id]">{{ task.title }}</a>
        </td>
      </ng-container>

      <ng-container matColumnDef="priority">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.priority' | translate }}</th>
        <td mat-cell *matCellDef="let task">
          <mat-chip [class]="'priority-' + task.priority">{{ 'priorities.' + task.priority | translate }}</mat-chip>
        </td>
      </ng-container>

      <ng-container matColumnDef="assignees">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.assignees' | translate }}</th>
        <td mat-cell *matCellDef="let task">
          <span *ngFor="let a of task.assignees; let last = last">
            {{ a.first_name }} {{ a.last_name }}<span *ngIf="!last">, </span>
          </span>
        </td>
      </ng-container>

      <ng-container matColumnDef="client">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.client' | translate }}</th>
        <td mat-cell *matCellDef="let task">{{ task.client?.name || '-' }}</td>
      </ng-container>

      <ng-container matColumnDef="tags">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.tags' | translate }}</th>
        <td mat-cell *matCellDef="let task">
          <mat-chip-set>
            <mat-chip *ngFor="let t of task.tags"
                      [style.background-color]="t.color"
                      [style.color]="isLightColor(t.color) ? '#000' : '#fff'"
                      class="tag-chip">
              {{ t.name }}
            </mat-chip>
          </mat-chip-set>
        </td>
      </ng-container>

      <ng-container matColumnDef="deadline">
        <th mat-header-cell *matHeaderCellDef>{{ 'tasks.deadline' | translate }}</th>
        <td mat-cell *matCellDef="let task">{{ task.deadline | date:'mediumDate' }}</td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
    </table>

    <mat-paginator
      [length]="totalCount"
      [pageSize]="pageSize"
      [pageIndex]="currentPage - 1"
      (page)="onPageChange($event)">
    </mat-paginator>
  `,
  styles: [`
    .archive-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .full-width { width: 100%; }
    table { margin-bottom: 16px; }
    a { text-decoration: none; color: #1976d2; }
    .tag-chip { font-size: 11px; min-height: 24px; padding: 2px 8px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskArchiveComponent implements OnInit, OnDestroy {
  tasks: TaskListItem[] = [];
  totalCount = 0;
  currentPage = 1;
  pageSize = 20;
  displayedColumns = ['title', 'priority', 'assignees', 'client', 'tags', 'deadline'];
  private searchTerm = '';
  private destroy$ = new Subject<void>();

  constructor(
    private taskService: TaskService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    const filters: TaskFilters = {
      page: this.currentPage,
      page_size: this.pageSize,
      status: 'archived',
    };
    if (this.searchTerm) {
      filters.search = this.searchTerm;
    }
    this.taskService.list(filters).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.tasks = res.results;
      this.totalCount = res.count;
      this.cdr.markForCheck();
    });
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.currentPage = 1;
    this.loadTasks();
  }

  isLightColor(hex: string): boolean {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadTasks();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
