import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ClientService, Client } from '../../../../core/services/client.service';
import { TagService, Tag } from '../../../../core/services/tag.service';

export interface FilterState {
  status?: string;
  priority?: string;
  deadline_from?: string;
  deadline_to?: string;
  client?: number;
  tags?: string;
  assignee?: number;
}

@Component({
    selector: 'app-filter-panel',
    imports: [
        CommonModule, FormsModule, MatSelectModule, MatFormFieldModule,
        MatDatepickerModule, MatNativeDateModule, MatInputModule,
        MatButtonModule, MatIconModule, TranslateModule,
    ],
    template: `
    <div class="filter-panel">
      <mat-form-field appearance="outline" class="compact-field" *ngIf="showStatus">
        <mat-label>{{ 'filters.status' | translate }}</mat-label>
        <mat-select [(ngModel)]="filters.status" (ngModelChange)="emitFilters()">
          <mat-option [value]="undefined">{{ 'common.all' | translate }}</mat-option>
          <mat-option value="created">{{ 'statuses.created' | translate }}</mat-option>
          <mat-option value="in_progress">{{ 'statuses.in_progress' | translate }}</mat-option>
          <mat-option value="waiting">{{ 'statuses.waiting' | translate }}</mat-option>
          <mat-option value="done">{{ 'statuses.done' | translate }}</mat-option>
          <mat-option value="archived">{{ 'statuses.archived' | translate }}</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="compact-field">
        <mat-label>{{ 'filters.priority' | translate }}</mat-label>
        <mat-select [(ngModel)]="filters.priority" (ngModelChange)="emitFilters()">
          <mat-option [value]="undefined">{{ 'common.all' | translate }}</mat-option>
          <mat-option value="low">{{ 'priorities.low' | translate }}</mat-option>
          <mat-option value="medium">{{ 'priorities.medium' | translate }}</mat-option>
          <mat-option value="high">{{ 'priorities.high' | translate }}</mat-option>
          <mat-option value="critical">{{ 'priorities.critical' | translate }}</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="compact-field">
        <mat-label>{{ 'filters.deadlineFrom' | translate }}</mat-label>
        <input matInput [matDatepicker]="fromPicker" [(ngModel)]="deadlineFrom" (dateChange)="onDeadlineChange()" />
        <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
        <mat-datepicker #fromPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="compact-field">
        <mat-label>{{ 'filters.deadlineTo' | translate }}</mat-label>
        <input matInput [matDatepicker]="toPicker" [(ngModel)]="deadlineTo" (dateChange)="onDeadlineChange()" />
        <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
        <mat-datepicker #toPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="compact-field" *ngIf="showClient">
        <mat-label>{{ 'filters.client' | translate }}</mat-label>
        <mat-select [(ngModel)]="filters.client" (ngModelChange)="emitFilters()">
          <mat-option [value]="undefined">{{ 'common.all' | translate }}</mat-option>
          <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="compact-field">
        <mat-label>{{ 'filters.tags' | translate }}</mat-label>
        <mat-select [(ngModel)]="selectedTagIds" (ngModelChange)="onTagsChange()" multiple>
          <mat-option *ngFor="let t of tags" [value]="t.id">{{ t.name }}</mat-option>
        </mat-select>
      </mat-form-field>

      <button class="clear-btn" (click)="clearFilters()">
        <mat-icon>filter_list_off</mat-icon>
        {{ 'filters.clearFilters' | translate }}
      </button>
    </div>
  `,
    styles: [`
    .filter-panel {
      display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
      margin-bottom: 16px;
    }
    .compact-field {
      min-width: 140px; max-width: 180px;
      font-size: 13px;
    }
    .clear-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: none; border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 8px; padding: 8px 14px;
      font-size: 13px; color: var(--text-secondary, #6b7280);
      cursor: pointer; transition: all 0.15s;
    }
    .clear-btn:hover { background: #f9fafb; color: var(--text-primary, #1a1a1a); }
    .clear-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterPanelComponent implements OnInit, OnDestroy {
  @Input() showStatus = true;
  @Input() showClient = true;
  @Output() filtersChange = new EventEmitter<FilterState>();
  filters: FilterState = {};
  deadlineFrom: Date | null = null;
  deadlineTo: Date | null = null;
  clients: Client[] = [];
  tags: Tag[] = [];
  selectedTagIds: number[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private clientService: ClientService,
    private tagService: TagService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (this.showClient) {
      this.clientService.list().pipe(takeUntil(this.destroy$)).subscribe((res) => {
        this.clients = res.results;
        this.cdr.markForCheck();
      });
    }
    this.tagService.list().pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.tags = res.results;
      this.cdr.markForCheck();
    });
  }

  onDeadlineChange(): void {
    if (this.deadlineFrom) {
      this.filters.deadline_from = this.formatDate(this.deadlineFrom);
    } else {
      delete this.filters.deadline_from;
    }
    if (this.deadlineTo) {
      this.filters.deadline_to = this.formatDate(this.deadlineTo);
    } else {
      delete this.filters.deadline_to;
    }
    this.emitFilters();
  }

  onTagsChange(): void {
    if (this.selectedTagIds.length) {
      this.filters.tags = this.selectedTagIds.join(',');
    } else {
      delete this.filters.tags;
    }
    this.emitFilters();
  }

  emitFilters(): void {
    const clean: any = {};
    Object.entries(this.filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v;
    });
    this.filtersChange.emit(clean);
  }

  clearFilters(): void {
    this.filters = {};
    this.deadlineFrom = null;
    this.deadlineTo = null;
    this.selectedTagIds = [];
    this.filtersChange.emit({});
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
