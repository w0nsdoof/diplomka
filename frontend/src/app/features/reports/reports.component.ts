import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { SummaryService, SummaryListItem } from '../../core/services/summary.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatTableModule, MatChipsModule,
    MatProgressSpinnerModule, MatSnackBarModule, TranslateModule,
  ],
  template: `
    <h2>{{ 'reports.title' | translate }}</h2>

    <!-- AI Summary Section -->
    <div class="ai-summary-section">
      <div class="section-header">
        <h3>{{ 'reports.aiSummaries' | translate }}</h3>
        <a mat-button color="primary" routerLink="/reports/summaries">
          <mat-icon>history</mat-icon> {{ 'reports.viewAllSummaries' | translate }}
        </a>
      </div>

      <div *ngIf="summaryLoading" style="text-align: center; padding: 24px;">
        <mat-spinner diameter="32"></mat-spinner>
      </div>

      <div class="summary-cards" *ngIf="!summaryLoading && (dailySummary || weeklySummary)">
        <mat-card *ngIf="dailySummary" class="summary-card clickable-card"
                  [routerLink]="['/reports/summaries', dailySummary.id]">
          <mat-card-header>
            <mat-card-title>{{ 'reports.dailySummary' | translate }}</mat-card-title>
            <mat-card-subtitle>
              {{ dailySummary.period_start }}
              <span class="method-badge" [class.ai]="dailySummary.generation_method === 'ai'" [class.fallback]="dailySummary.generation_method === 'fallback'">
                {{ dailySummary.generation_method === 'ai' ? ('reports.ai' | translate) : ('reports.fallback' | translate) }}
              </span>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="summary-preview">{{ dailySummary.summary_text | slice:0:200 }}{{ dailySummary.summary_text.length > 200 ? '...' : '' }}</p>
            <small class="generated-at">{{ 'reports.generated' | translate }} {{ dailySummary.generated_at | date:'medium' }}</small>
          </mat-card-content>
        </mat-card>

        <mat-card *ngIf="weeklySummary" class="summary-card clickable-card"
                  [routerLink]="['/reports/summaries', weeklySummary.id]">
          <mat-card-header>
            <mat-card-title>{{ 'reports.weeklySummary' | translate }}</mat-card-title>
            <mat-card-subtitle>
              {{ weeklySummary.period_start }} — {{ weeklySummary.period_end }}
              <span class="method-badge" [class.ai]="weeklySummary.generation_method === 'ai'" [class.fallback]="weeklySummary.generation_method === 'fallback'">
                {{ weeklySummary.generation_method === 'ai' ? ('reports.ai' | translate) : ('reports.fallback' | translate) }}
              </span>
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="summary-preview">{{ weeklySummary.summary_text | slice:0:200 }}{{ weeklySummary.summary_text.length > 200 ? '...' : '' }}</p>
            <small class="generated-at">{{ 'reports.generated' | translate }} {{ weeklySummary.generated_at | date:'medium' }}</small>
          </mat-card-content>
        </mat-card>
      </div>

      <p *ngIf="!summaryLoading && !dailySummary && !weeklySummary" class="no-summaries">
        {{ 'reports.noSummaries' | translate }}
      </p>
    </div>

    <!-- On-demand AI Summary Generation -->
    <mat-card *ngIf="isManager" class="on-demand-card">
      <mat-card-header>
        <mat-card-title>{{ 'reports.generateAiSummary' | translate }}</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'reports.startDate' | translate }}</mat-label>
            <input matInput [matDatepicker]="aiFromPicker" [(ngModel)]="aiDateFrom" />
            <mat-datepicker-toggle matIconSuffix [for]="aiFromPicker"></mat-datepicker-toggle>
            <mat-datepicker #aiFromPicker></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'reports.endDate' | translate }}</mat-label>
            <input matInput [matDatepicker]="aiToPicker" [(ngModel)]="aiDateTo" />
            <mat-datepicker-toggle matIconSuffix [for]="aiToPicker"></mat-datepicker-toggle>
            <mat-datepicker #aiToPicker></mat-datepicker>
          </mat-form-field>
          <button mat-raised-button color="accent"
                  (click)="generateAISummary()"
                  [disabled]="!aiDateFrom || !aiDateTo || generating">
            <mat-icon>auto_awesome</mat-icon>
            {{ generating ? ('reports.generating' | translate) : ('reports.generateAiSummary' | translate) }}
          </button>
        </div>
      </mat-card-content>
    </mat-card>

    <!-- Existing Reports Section -->
    <mat-card class="filter-card">
      <mat-card-content>
        <div class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'reports.dateFrom' | translate }}</mat-label>
            <input matInput [matDatepicker]="fromPicker" [(ngModel)]="dateFrom" />
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
            <mat-datepicker #fromPicker></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'reports.dateTo' | translate }}</mat-label>
            <input matInput [matDatepicker]="toPicker" [(ngModel)]="dateTo" />
            <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
            <mat-datepicker #toPicker></mat-datepicker>
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="loadReport()">{{ 'reports.generate' | translate }}</button>
          <button mat-button *ngIf="isManager" (click)="exportPDF()"><mat-icon>picture_as_pdf</mat-icon> {{ 'reports.pdf' | translate }}</button>
          <button mat-button *ngIf="isManager" (click)="exportExcel()"><mat-icon>table_chart</mat-icon> {{ 'reports.excel' | translate }}</button>
        </div>
      </mat-card-content>
    </mat-card>

    <div *ngIf="reportData" class="report-content">
      <div class="summary-grid">
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.total }}</div><div>{{ 'reports.total' | translate }}</div></mat-card-content></mat-card>
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.created_in_period }}</div><div>{{ 'reports.created' | translate }}</div></mat-card-content></mat-card>
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.closed_in_period }}</div><div>{{ 'reports.closed' | translate }}</div></mat-card-content></mat-card>
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.overdue }}</div><div>{{ 'reports.overdue' | translate }}</div></mat-card-content></mat-card>
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
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .section-header h3 { margin: 0; }
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 16px; margin-bottom: 12px; }
    .clickable-card { cursor: pointer; transition: box-shadow 0.2s; }
    .clickable-card:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
    .summary-preview { white-space: pre-line; line-height: 1.6; }
    .no-summaries { color: #666; font-style: italic; }
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
  isManager = false;
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
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
    public translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
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
        this.snackBar.open(this.translate.instant('reports.summaryStarted'), this.translate.instant('common.view'), { duration: 5000 }).onAction().subscribe(() => {
          this.router.navigate(['/reports/summaries', result.id]);
        });
        this.cdr.markForCheck();
      },
      error: () => {
        this.generating = false;
        this.snackBar.open(this.translate.instant('reports.failedGeneration'), this.translate.instant('common.dismiss'), { duration: 3000 });
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
