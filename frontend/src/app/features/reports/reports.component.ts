import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { SummaryService, SummaryListItem } from '../../core/services/summary.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatTableModule, MatChipsModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <h2>Reports</h2>

    <!-- AI Summary Section -->
    <div class="ai-summary-section" *ngIf="dailySummary || weeklySummary">
      <h3>AI Summaries</h3>
      <div class="summary-cards">
        <mat-card *ngIf="dailySummary" class="summary-card">
          <mat-card-header>
            <mat-card-title>Daily Summary</mat-card-title>
            <mat-card-subtitle>
              {{ dailySummary.period_start }}
              <span class="method-badge" [class.ai]="dailySummary.generation_method === 'ai'" [class.fallback]="dailySummary.generation_method === 'fallback'">
                {{ dailySummary.generation_method === 'ai' ? 'AI' : 'Fallback' }}
              </span>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="summary-text">{{ dailySummary.summary_text }}</p>
            <small class="generated-at">Generated: {{ dailySummary.generated_at | date:'medium' }}</small>
          </mat-card-content>
        </mat-card>

        <mat-card *ngIf="weeklySummary" class="summary-card">
          <mat-card-header>
            <mat-card-title>Weekly Summary</mat-card-title>
            <mat-card-subtitle>
              {{ weeklySummary.period_start }} — {{ weeklySummary.period_end }}
              <span class="method-badge" [class.ai]="weeklySummary.generation_method === 'ai'" [class.fallback]="weeklySummary.generation_method === 'fallback'">
                {{ weeklySummary.generation_method === 'ai' ? 'AI' : 'Fallback' }}
              </span>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="summary-text">{{ weeklySummary.summary_text }}</p>
            <small class="generated-at">Generated: {{ weeklySummary.generated_at | date:'medium' }}</small>
          </mat-card-content>
        </mat-card>
      </div>
      <a mat-button color="primary" routerLink="/reports/summaries">
        <mat-icon>history</mat-icon> View Summary History
      </a>
    </div>

    <div *ngIf="summaryLoading" style="text-align: center; padding: 24px;">
      <mat-spinner diameter="32"></mat-spinner>
    </div>

    <!-- On-demand AI Summary Generation -->
    <mat-card class="on-demand-card">
      <mat-card-header>
        <mat-card-title>Generate AI Summary</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Start Date</mat-label>
            <input matInput [matDatepicker]="aiFromPicker" [(ngModel)]="aiDateFrom" />
            <mat-datepicker-toggle matIconSuffix [for]="aiFromPicker"></mat-datepicker-toggle>
            <mat-datepicker #aiFromPicker></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>End Date</mat-label>
            <input matInput [matDatepicker]="aiToPicker" [(ngModel)]="aiDateTo" />
            <mat-datepicker-toggle matIconSuffix [for]="aiToPicker"></mat-datepicker-toggle>
            <mat-datepicker #aiToPicker></mat-datepicker>
          </mat-form-field>
          <button mat-raised-button color="accent"
                  (click)="generateAISummary()"
                  [disabled]="!aiDateFrom || !aiDateTo || generating">
            <mat-icon>auto_awesome</mat-icon>
            {{ generating ? 'Generating...' : 'Generate AI Summary' }}
          </button>
        </div>
      </mat-card-content>
    </mat-card>

    <!-- Existing Reports Section -->
    <mat-card class="filter-card">
      <mat-card-content>
        <div class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Date From</mat-label>
            <input matInput [matDatepicker]="fromPicker" [(ngModel)]="dateFrom" />
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
            <mat-datepicker #fromPicker></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Date To</mat-label>
            <input matInput [matDatepicker]="toPicker" [(ngModel)]="dateTo" />
            <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
            <mat-datepicker #toPicker></mat-datepicker>
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="loadReport()">Generate</button>
          <button mat-button (click)="exportPDF()"><mat-icon>picture_as_pdf</mat-icon> PDF</button>
          <button mat-button (click)="exportExcel()"><mat-icon>table_chart</mat-icon> Excel</button>
        </div>
      </mat-card-content>
    </mat-card>

    <div *ngIf="reportData" class="report-content">
      <div class="summary-grid">
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.total }}</div><div>Total</div></mat-card-content></mat-card>
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.created_in_period }}</div><div>Created</div></mat-card-content></mat-card>
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.closed_in_period }}</div><div>Closed</div></mat-card-content></mat-card>
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.overdue }}</div><div>Overdue</div></mat-card-content></mat-card>
      </div>
    </div>
  `,
  styles: [`
    .filter-card { margin-bottom: 24px; }
    .filter-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .stat { font-size: 32px; font-weight: bold; text-align: center; }
    .report-content { margin-top: 24px; }
    .ai-summary-section { margin-bottom: 32px; }
    .ai-summary-section h3 { margin-bottom: 16px; }
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 16px; margin-bottom: 12px; }
    .summary-card { }
    .summary-text { white-space: pre-line; line-height: 1.6; }
    .generated-at { color: #666; }
    .method-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      margin-left: 8px;
      text-transform: uppercase;
    }
    .method-badge.ai { background: #e8f5e9; color: #2e7d32; }
    .method-badge.fallback { background: #fff3e0; color: #e65100; }
    .on-demand-card { margin-bottom: 24px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent implements OnInit, OnDestroy {
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  reportData: any = null;
  dailySummary: SummaryListItem | null = null;
  weeklySummary: SummaryListItem | null = null;
  summaryLoading = false;
  aiDateFrom: Date | null = null;
  aiDateTo: Date | null = null;
  generating = false;
  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private summaryService: SummaryService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadLatestSummaries();
  }

  loadLatestSummaries(): void {
    this.summaryLoading = true;
    this.cdr.markForCheck();
    this.summaryService.getLatest().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.dailySummary = data.daily;
        this.weeklySummary = data.weekly;
        this.summaryLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.summaryLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  generateAISummary(): void {
    if (!this.aiDateFrom || !this.aiDateTo) return;
    this.generating = true;
    this.cdr.markForCheck();
    const start = this.aiDateFrom.toISOString().split('T')[0];
    const end = this.aiDateTo.toISOString().split('T')[0];
    this.summaryService.generate(start, end).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.generating = false;
        this.snackBar.open('Summary generation started', 'View', { duration: 5000 }).onAction().subscribe(() => {
          window.location.href = `/reports/summaries/${result.id}`;
        });
        this.cdr.markForCheck();
      },
      error: () => {
        this.generating = false;
        this.snackBar.open('Failed to start generation', 'Dismiss', { duration: 3000 });
        this.cdr.markForCheck();
      },
    });
  }

  loadReport(): void {
    let params = new HttpParams();
    if (this.dateFrom) params = params.set('date_from', this.dateFrom.toISOString().split('T')[0]);
    if (this.dateTo) params = params.set('date_to', this.dateTo.toISOString().split('T')[0]);
    this.http.get(`${environment.apiUrl}/reports/summary/`, { params }).pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.reportData = data;
      this.cdr.markForCheck();
    });
  }

  exportPDF(): void {
    let params = new HttpParams();
    if (this.dateFrom) params = params.set('date_from', this.dateFrom.toISOString().split('T')[0]);
    if (this.dateTo) params = params.set('date_to', this.dateTo.toISOString().split('T')[0]);
    this.http.get(`${environment.apiUrl}/reports/export/pdf/`, { params, responseType: 'blob' }).pipe(takeUntil(this.destroy$)).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'report.pdf'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  exportExcel(): void {
    let params = new HttpParams();
    if (this.dateFrom) params = params.set('date_from', this.dateFrom.toISOString().split('T')[0]);
    if (this.dateTo) params = params.set('date_to', this.dateTo.toISOString().split('T')[0]);
    this.http.get(`${environment.apiUrl}/reports/export/excel/`, { params, responseType: 'blob' }).pipe(takeUntil(this.destroy$)).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'report.xlsx'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
