import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Subject, takeUntil } from 'rxjs';
import { ClientService, Client } from '../../../../core/services/client.service';

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
    MatButtonModule,
  ],
  template: `
    <div class="filter-panel">
      <mat-form-field appearance="outline" *ngIf="showStatus">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="filters.status" (ngModelChange)="emitFilters()">
          <mat-option [value]="undefined">All</mat-option>
          <mat-option value="created">Created</mat-option>
          <mat-option value="in_progress">In Progress</mat-option>
          <mat-option value="waiting">Waiting</mat-option>
          <mat-option value="done">Done</mat-option>
          <mat-option value="archived">Archived</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Priority</mat-label>
        <mat-select [(ngModel)]="filters.priority" (ngModelChange)="emitFilters()">
          <mat-option [value]="undefined">All</mat-option>
          <mat-option value="low">Low</mat-option>
          <mat-option value="medium">Medium</mat-option>
          <mat-option value="high">High</mat-option>
          <mat-option value="critical">Critical</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Deadline from</mat-label>
        <input matInput [matDatepicker]="fromPicker" [(ngModel)]="deadlineFrom" (dateChange)="onDeadlineChange()" />
        <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
        <mat-datepicker #fromPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Deadline to</mat-label>
        <input matInput [matDatepicker]="toPicker" [(ngModel)]="deadlineTo" (dateChange)="onDeadlineChange()" />
        <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
        <mat-datepicker #toPicker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" *ngIf="showClient">
        <mat-label>Client</mat-label>
        <mat-select [(ngModel)]="filters.client" (ngModelChange)="emitFilters()">
          <mat-option [value]="undefined">All</mat-option>
          <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-button (click)="clearFilters()">Clear Filters</button>
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
  private destroy$ = new Subject<void>();

  constructor(
    private clientService: ClientService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (this.showClient) {
      this.clientService.list().pipe(takeUntil(this.destroy$)).subscribe((res) => {
        this.clients = res.results;
        this.cdr.markForCheck();
      });
    }
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
