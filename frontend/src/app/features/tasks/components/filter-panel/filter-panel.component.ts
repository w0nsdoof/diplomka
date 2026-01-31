import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TagService, Tag } from '../../../../core/services/tag.service';
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
    MatButtonModule, MatSlideToggleModule,
  ],
  template: `
    <div class="filter-panel">
      <mat-form-field appearance="outline">
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
})
export class FilterPanelComponent implements OnInit {
  @Output() filtersChange = new EventEmitter<FilterState>();
  filters: FilterState = {};
  tags: Tag[] = [];
  clients: Client[] = [];

  constructor(
    private tagService: TagService,
    private clientService: ClientService,
  ) {}

  ngOnInit(): void {
    this.tagService.list().subscribe((res) => (this.tags = res.results));
    this.clientService.list().subscribe((res) => (this.clients = res.results));
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
    this.filtersChange.emit({});
  }
}
