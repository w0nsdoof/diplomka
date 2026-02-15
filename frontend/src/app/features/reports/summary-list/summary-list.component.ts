import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { SummaryService, SummaryListItem } from '../../../core/services/summary.service';

@Component({
  selector: 'app-summary-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule, MatCardModule, MatTableModule,
    MatButtonModule, MatButtonToggleModule, MatIconModule, MatChipsModule,
    MatPaginatorModule,
  ],
  template: `
    <div class="header-row">
      <h2>Summary History</h2>
      <a mat-button routerLink="/reports"><mat-icon>arrow_back</mat-icon> Back to Reports</a>
    </div>

    <mat-card>
      <mat-card-content>
        <div class="filter-row">
          <mat-button-toggle-group [(ngModel)]="selectedPeriod" (change)="loadSummaries()">
            <mat-button-toggle value="">All</mat-button-toggle>
            <mat-button-toggle value="daily">Daily</mat-button-toggle>
            <mat-button-toggle value="weekly">Weekly</mat-button-toggle>
            <mat-button-toggle value="on_demand">On-demand</mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        <table mat-table [dataSource]="summaries" class="full-width">
          <ng-container matColumnDef="period">
            <th mat-header-cell *matHeaderCellDef>Period</th>
            <td mat-cell *matCellDef="let s">{{ s.period_start }} — {{ s.period_end }}</td>
          </ng-container>

          <ng-container matColumnDef="period_type">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let s">
              <span class="type-chip" [ngClass]="s.period_type">{{ s.period_type }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let s">
              <span class="status-badge" [ngClass]="s.status">{{ s.status }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="method">
            <th mat-header-cell *matHeaderCellDef>Method</th>
            <td mat-cell *matCellDef="let s">
              <span *ngIf="s.generation_method" class="method-badge" [ngClass]="s.generation_method">
                {{ s.generation_method === 'ai' ? 'AI' : 'Fallback' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="preview">
            <th mat-header-cell *matHeaderCellDef>Preview</th>
            <td mat-cell *matCellDef="let s" class="preview-cell">
              {{ s.summary_text | slice:0:100 }}{{ s.summary_text.length > 100 ? '...' : '' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="generated_at">
            <th mat-header-cell *matHeaderCellDef>Generated</th>
            <td mat-cell *matCellDef="let s">{{ s.generated_at | date:'short' }}</td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"
              (click)="viewSummary(row)" class="clickable-row"></tr>
        </table>

        <mat-paginator
          [length]="totalCount"
          [pageSize]="20"
          [pageIndex]="currentPage"
          (page)="onPage($event)"
          showFirstLastButtons>
        </mat-paginator>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .filter-row { margin-bottom: 16px; }
    .full-width { width: 100%; }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: rgba(0, 0, 0, 0.04); }
    .preview-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .type-chip {
      padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize;
    }
    .type-chip.daily { background: #e3f2fd; color: #1565c0; }
    .type-chip.weekly { background: #f3e5f5; color: #7b1fa2; }
    .type-chip.on_demand { background: #e8eaf6; color: #283593; }
    .status-badge {
      padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize;
    }
    .status-badge.completed { background: #e8f5e9; color: #2e7d32; }
    .status-badge.pending { background: #fff3e0; color: #e65100; }
    .status-badge.generating { background: #e3f2fd; color: #1565c0; }
    .status-badge.failed { background: #ffebee; color: #c62828; }
    .method-badge {
      padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; text-transform: uppercase;
    }
    .method-badge.ai { background: #e8f5e9; color: #2e7d32; }
    .method-badge.fallback { background: #fff3e0; color: #e65100; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryListComponent implements OnInit, OnDestroy {
  summaries: SummaryListItem[] = [];
  totalCount = 0;
  currentPage = 0;
  selectedPeriod = '';
  displayedColumns = ['period', 'period_type', 'status', 'method', 'preview', 'generated_at'];
  private destroy$ = new Subject<void>();

  constructor(
    private summaryService: SummaryService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadSummaries();
  }

  loadSummaries(): void {
    const filters: any = { page: this.currentPage + 1 };
    if (this.selectedPeriod) {
      filters.period_type = this.selectedPeriod;
    }
    this.summaryService.list(filters).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.summaries = res.results;
      this.totalCount = res.count;
      this.cdr.markForCheck();
    });
  }

  onPage(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.loadSummaries();
  }

  viewSummary(summary: SummaryListItem): void {
    this.router.navigate(['/reports/summaries', summary.id]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
