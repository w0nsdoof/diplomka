import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
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
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatSelectModule, MatFormFieldModule,
    MatDatepickerModule, MatNativeDateModule, MatInputModule,
    MatButtonModule, TranslateModule,
  ],
  template: `
    <div class="filter-panel">
      <mat-form-field appearance="outline" *ngIf="showStatus">
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

      <mat-form-field appearance="outline">
        <mat-label>{{ 'filters.priority' | translate }}</mat-label>
        <mat-select [(ngModel)]="filters.priority" (ngModelChange)="emitFilters()">
          <mat-option [value]="undefined">{{ 'common.all' | translate }}</mat-option>
          <mat-option value="low">{{ 'priorities.low' | translate }}</mat-option>
          <mat-option value="medium">{{ 'priorities.medium' | translate }}</mat-option>
          <mat-option value="high">{{ 'priorities.high' | translate }}</mat-option>
          <mat-option value="critical">{{ 'priorities.critical' | translate }}</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>{{ 'filters.deadlineFrom' | translate }}</mat-label>
        <input matInput [matDatepicker]="fromPicker" [(ngModel)]="deadlineFrom" (dateChange)="onDeadlineChange()" />
        <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
        <mat-datepicker #fromPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>{{ 'filters.deadlineTo' | translate }}</mat-label>
        <input matInput [matDatepicker]="toPicker" [(ngModel)]="deadlineTo" (dateChange)="onDeadlineChange()" />
        <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
        <mat-datepicker #toPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" *ngIf="showClient">
        <mat-label>{{ 'filters.client' | translate }}</mat-label>
        <mat-select [(ngModel)]="filters.client" (ngModelChange)="emitFilters()">
          <mat-option [value]="undefined">{{ 'common.all' | translate }}</mat-option>
          <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>{{ 'filters.tags' | translate }}</mat-label>
        <mat-select [(ngModel)]="selectedTagSlugs" (ngModelChange)="onTagsChange()" multiple>
          <mat-option *ngFor="let t of tags" [value]="t.slug">{{ t.name }}</mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-button (click)="clearFilters()">{{ 'filters.clearFilters' | translate }}</button>
    </div>
  `,
  styles: [`
    .filter-panel { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
    mat-form-field { min-width: 150px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  selectedTagSlugs: string[] = [];
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
    if (this.selectedTagSlugs.length) {
      this.filters.tags = this.selectedTagSlugs.join(',');
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
    this.selectedTagSlugs = [];
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
