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
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { SummaryService, SummaryListItem } from '../../core/services/summary.service';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { ClientService } from '../../core/services/client.service';

@Component({
    selector: 'app-reports',
    imports: [
        CommonModule, FormsModule, RouterModule, MatCardModule, MatFormFieldModule,
        MatInputModule, MatDatepickerModule, MatNativeDateModule,
        MatButtonModule, MatIconModule, MatTableModule, MatChipsModule,
        MatProgressSpinnerModule, MatSnackBarModule, MatSelectModule, TranslateModule,
    ],
    template: `
    <div class="page-header">
      <h2>{{ 'nav.analytics' | translate }}</h2>
      <a mat-button routerLink="/reports/summaries" class="flat-btn-outline">
        <mat-icon>history</mat-icon> {{ 'reports.viewAllSummaries' | translate }}
      </a>
    </div>

    <!-- AI Summary Section -->
    <div class="ai-summary-section">
      <h3 class="section-title">{{ 'reports.aiSummaries' | translate }}</h3>

      <div *ngIf="summaryLoading" style="text-align: center; padding: 24px;">
        <mat-spinner diameter="32"></mat-spinner>
      </div>

      <div class="summary-cards" *ngIf="!summaryLoading && (dailySummary || weeklySummary)">
        <div *ngIf="dailySummary" class="summary-card"
             [routerLink]="['/reports/summaries', dailySummary.id]">
          <div class="summary-card-accent"></div>
          <div class="summary-card-body">
            <div class="summary-card-header">
              <strong>{{ 'reports.dailySummary' | translate }}</strong>
              <span class="method-badge" [class.ai]="dailySummary.generation_method === 'ai'" [class.fallback]="dailySummary.generation_method === 'fallback'">
                {{ dailySummary.generation_method === 'ai' ? ('reports.ai' | translate) : ('reports.fallback' | translate) }}
              </span>
            </div>
            <p class="summary-period">{{ dailySummary.period_start }}</p>
            <p class="summary-preview">{{ dailySummary.summary_text | slice:0:200 }}{{ dailySummary.summary_text.length > 200 ? '...' : '' }}</p>
            <small class="generated-at">{{ 'reports.generated' | translate }} {{ dailySummary.generated_at | date:'medium' }}</small>
          </div>
        </div>

        <div *ngIf="weeklySummary" class="summary-card"
             [routerLink]="['/reports/summaries', weeklySummary.id]">
          <div class="summary-card-accent"></div>
          <div class="summary-card-body">
            <div class="summary-card-header">
              <strong>{{ 'reports.weeklySummary' | translate }}</strong>
              <span class="method-badge" [class.ai]="weeklySummary.generation_method === 'ai'" [class.fallback]="weeklySummary.generation_method === 'fallback'">
                {{ weeklySummary.generation_method === 'ai' ? ('reports.ai' | translate) : ('reports.fallback' | translate) }}
              </span>
            </div>
            <p class="summary-period">{{ weeklySummary.period_start }} — {{ weeklySummary.period_end }}</p>
            <p class="summary-preview">{{ weeklySummary.summary_text | slice:0:200 }}{{ weeklySummary.summary_text.length > 200 ? '...' : '' }}</p>
            <small class="generated-at">{{ 'reports.generated' | translate }} {{ weeklySummary.generated_at | date:'medium' }}</small>
          </div>
        </div>
      </div>

      <p *ngIf="!summaryLoading && !dailySummary && !weeklySummary" class="no-summaries">
        {{ 'reports.noSummaries' | translate }}
      </p>
    </div>

    <!-- On-demand AI Summary Generation -->
    <div *ngIf="isManager" class="flat-card on-demand-section">
      <h3 class="section-title">{{ 'reports.generateAiSummary' | translate }}</h3>
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
        <mat-form-field appearance="outline" class="scope-field">
          <mat-label>{{ 'reports.project' | translate }}</mat-label>
          <mat-select [(ngModel)]="aiProjectId">
            <mat-option [value]="null">{{ 'reports.allProjects' | translate }}</mat-option>
            <mat-option *ngFor="let p of projects" [value]="p.id">{{ p.title }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="scope-field">
          <mat-label>{{ 'reports.client' | translate }}</mat-label>
          <mat-select [(ngModel)]="aiClientId">
            <mat-option [value]="null">{{ 'reports.allClients' | translate }}</mat-option>
            <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
      <div class="filter-row">
        <mat-form-field appearance="outline" class="focus-field">
          <mat-label>{{ 'reports.focusPrompt' | translate }}</mat-label>
          <input matInput [(ngModel)]="aiFocusPrompt" [placeholder]="'reports.focusPlaceholder' | translate" maxlength="500" />
        </mat-form-field>
        <button class="flat-btn-primary"
                (click)="generateAISummary()"
                [disabled]="!aiDateFrom || !aiDateTo || generating">
          <mat-icon>auto_awesome</mat-icon>
          {{ generating ? ('reports.generating' | translate) : ('reports.generateAiSummary' | translate) }}
        </button>
      </div>
    </div>

    <!-- Existing Reports Section -->
    <div class="flat-card report-section">
      <h3 class="section-title">{{ 'reports.title' | translate }}</h3>
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
        <button class="flat-btn-primary" (click)="loadReport()">{{ 'reports.generate' | translate }}</button>
        <button *ngIf="isManager" class="flat-btn-outline export-pdf" (click)="exportPDF()">
          <mat-icon>picture_as_pdf</mat-icon> {{ 'reports.pdf' | translate }}
        </button>
        <button *ngIf="isManager" class="flat-btn-outline export-excel" (click)="exportExcel()">
          <mat-icon>table_chart</mat-icon> {{ 'reports.excel' | translate }}
        </button>
      </div>
    </div>

    <div *ngIf="reportData" class="report-content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ reportData.tasks.total }}</div>
          <div class="stat-label">{{ 'reports.total' | translate }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ reportData.tasks.created_in_period }}</div>
          <div class="stat-label">{{ 'reports.created' | translate }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ reportData.tasks.closed_in_period }}</div>
          <div class="stat-label">{{ 'reports.closed' | translate }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ reportData.tasks.overdue }}</div>
          <div class="stat-label">{{ 'reports.overdue' | translate }}</div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px;
    }
    .page-header h2 { font-size: 22px; font-weight: 700; margin: 0; }

    .section-title { font-size: 16px; font-weight: 600; margin: 0 0 16px 0; }

    .ai-summary-section { margin-bottom: 24px; }

    .summary-cards {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 16px; margin-bottom: 12px;
    }
    .summary-card {
      display: flex; background: #fff;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: var(--border-radius-card, 12px);
      cursor: pointer; transition: box-shadow 0.2s; overflow: hidden;
    }
    .summary-card:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); }
    .summary-card-accent {
      width: 4px; background: #fbbf24; flex-shrink: 0;
    }
    .summary-card-body { padding: 20px; flex: 1; }
    .summary-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .summary-period { font-size: 13px; color: var(--text-secondary, #6b7280); margin: 0 0 8px 0; }
    .summary-preview { white-space: pre-line; line-height: 1.6; margin: 0 0 8px 0; font-size: 14px; }
    .no-summaries { color: #666; font-style: italic; }
    .generated-at { color: #9ca3af; font-size: 12px; }

    .method-badge {
      display: inline-block; padding: 2px 8px; border-radius: 12px;
      font-size: 11px; font-weight: 500; text-transform: uppercase;
    }
    .method-badge.ai { background: #e8f5e9; color: #2e7d32; }
    .method-badge.fallback { background: #fff3e0; color: #e65100; }

    .on-demand-section { margin-bottom: 24px; }
    .report-section { margin-bottom: 24px; }

    .filter-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .scope-field { min-width: 160px; }
    .focus-field { flex: 1; min-width: 300px; }

    .export-pdf { color: #dc2626; border-color: #fecaca; }
    .export-pdf:hover { background: #fef2f2; }
    .export-excel { color: #16a34a; border-color: #bbf7d0; }
    .export-excel:hover { background: #f0fdf4; }

    .stats-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
      margin-top: 24px;
    }
    .report-content { margin-top: 0; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
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
  aiProjectId: number | null = null;
  aiClientId: number | null = null;
  aiFocusPrompt = '';
  generating = false;
  projects: { id: number; title: string }[] = [];
  clients: { id: number; name: string }[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private summaryService: SummaryService,
    private authService: AuthService,
    private projectService: ProjectService,
    private clientService: ClientService,
    private snackBar: MatSnackBar,
    private router: Router,
    public translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
    this.loadLatestSummaries();
    if (this.isManager) {
      this.loadScopeOptions();
    }
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

  loadScopeOptions(): void {
    this.projectService.listProjects({ page_size: 100 }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.projects = res.results.map(p => ({ id: p.id, title: p.title }));
        this.cdr.markForCheck();
      },
    });
    this.clientService.list().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.clients = res.results.map(c => ({ id: c.id, name: c.name }));
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
    this.summaryService.generate(start, end, {
      projectId: this.aiProjectId,
      clientId: this.aiClientId,
      focusPrompt: this.aiFocusPrompt,
    }).pipe(takeUntil(this.destroy$)).subscribe({
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
