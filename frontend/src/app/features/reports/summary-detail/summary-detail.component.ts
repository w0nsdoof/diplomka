import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { SummaryService, SummaryDetail, SummaryVersion } from '../../../core/services/summary.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-summary-detail',
    imports: [
        CommonModule, RouterModule, MatCardModule, MatButtonModule,
        MatIconModule, MatChipsModule, MatListModule, MatDividerModule,
        MatExpansionModule, MatProgressSpinnerModule, MatSnackBarModule,
        TranslateModule, BaseChartDirective,
    ],
    template: `
    <div class="header-row">
      <h2>{{ 'summaries.detailTitle' | translate }}</h2>
      <a mat-button routerLink="/reports/summaries"><mat-icon>arrow_back</mat-icon> {{ 'summaries.backToHistory' | translate }}</a>
    </div>

    <div *ngIf="loading" style="text-align: center; padding: 48px;">
      <mat-spinner diameter="40"></mat-spinner>
    </div>

    <div *ngIf="summary && !loading">
      <!-- Scope badges -->
      <div *ngIf="summary.project_scope || summary.client_scope || summary.focus_prompt" class="scope-bar">
        <span *ngIf="summary.project_scope" class="scope-badge project">
          <mat-icon class="scope-icon">folder</mat-icon> {{ summary.project_scope.name }}
        </span>
        <span *ngIf="summary.client_scope" class="scope-badge client">
          <mat-icon class="scope-icon">business</mat-icon> {{ summary.client_scope.name }}
        </span>
        <span *ngIf="summary.focus_prompt" class="scope-badge focus">
          <mat-icon class="scope-icon">center_focus_strong</mat-icon> {{ summary.focus_prompt }}
        </span>
      </div>

      <mat-card class="detail-card">
        <mat-card-header>
          <mat-card-title>
            <span class="type-chip" [ngClass]="summary.period_type">{{ summary.period_type }}</span>
            {{ summary.period_start }} — {{ summary.period_end }}
          </mat-card-title>
          <mat-card-subtitle>
            <span class="status-badge" [ngClass]="summary.status">{{ summary.status }}</span>
            <span *ngIf="summary.generation_method" class="method-badge" [ngClass]="summary.generation_method">
              {{ summary.generation_method === 'ai' ? ('reports.ai' | translate) : ('reports.fallback' | translate) }}
            </span>
            <span class="meta-info">{{ 'reports.generated' | translate }} {{ summary.generated_at | date:'medium' }}</span>
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="hasSections(); else plainText" class="structured-summary">
            <div *ngFor="let section of orderedSections()" class="summary-section">
              <h3 class="section-header">{{ section }}</h3>
              <div class="section-content" [innerHTML]="renderMarkdown(summary.sections![section])"></div>
            </div>
          </div>
          <ng-template #plainText>
            <p class="summary-text">{{ summary.summary_text }}</p>
          </ng-template>

          <!-- Charts Section -->
          <div *ngIf="hasChartData" class="charts-section">
            <mat-divider></mat-divider>
            <h3 class="charts-title">{{ 'summaries.visualBreakdown' | translate }}</h3>
            <div class="charts-grid">
              <div *ngIf="statusChartData" class="chart-card">
                <h4>{{ 'summaries.statusDistribution' | translate }}</h4>
                <canvas baseChart
                  [type]="'doughnut'"
                  [data]="statusChartData"
                  [options]="doughnutOptions">
                </canvas>
              </div>
              <div *ngIf="priorityChartData" class="chart-card">
                <h4>{{ 'summaries.priorityDistribution' | translate }}</h4>
                <canvas baseChart
                  [type]="'bar'"
                  [data]="priorityChartData"
                  [options]="barOptions">
                </canvas>
              </div>
              <div *ngIf="engineerChartData" class="chart-card chart-card-wide">
                <h4>{{ 'summaries.engineerWorkload' | translate }}</h4>
                <canvas baseChart
                  [type]="'bar'"
                  [data]="engineerChartData"
                  [options]="stackedBarOptions">
                </canvas>
              </div>
              <div *ngIf="clientChartData" class="chart-card">
                <h4>{{ 'summaries.clientActivity' | translate }}</h4>
                <canvas baseChart
                  [type]="'bar'"
                  [data]="clientChartData"
                  [options]="barOptions">
                </canvas>
              </div>
            </div>
          </div>

          <mat-divider></mat-divider>

          <div class="metadata">
            <h4>{{ 'summaries.generationDetails' | translate }}</h4>
            <div class="meta-grid">
              <div *ngIf="summary.llm_model"><strong>{{ 'summaries.model' | translate }}</strong> {{ summary.llm_model }}</div>
              <div *ngIf="summary.prompt_tokens != null"><strong>{{ 'summaries.promptTokens' | translate }}</strong> {{ summary.prompt_tokens }}</div>
              <div *ngIf="summary.completion_tokens != null"><strong>{{ 'summaries.completionTokens' | translate }}</strong> {{ summary.completion_tokens }}</div>
              <div *ngIf="summary.generation_time_ms != null"><strong>{{ 'summaries.generationTime' | translate }}</strong> {{ summary.generation_time_ms }}ms</div>
              <div *ngIf="summary.requested_by"><strong>{{ 'summaries.requestedBy' | translate }}</strong> {{ summary.requested_by.first_name }} {{ summary.requested_by.last_name }}</div>
              <div><strong>{{ 'summaries.versions' | translate }}</strong> {{ summary.version_count }}</div>
            </div>
            <div *ngIf="summary.error_message" class="error-msg">
              <strong>{{ 'summaries.error' | translate }}</strong> {{ summary.error_message }}
            </div>
          </div>

          <mat-accordion *ngIf="isManager && summary.prompt_text" class="prompt-accordion">
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>{{ 'summaries.promptSent' | translate }}</mat-panel-title>
              </mat-expansion-panel-header>
              <pre class="prompt-text">{{ summary.prompt_text }}</pre>
            </mat-expansion-panel>
          </mat-accordion>
        </mat-card-content>
        <mat-card-actions *ngIf="isManager">
          <button mat-raised-button color="primary" (click)="regenerate()" [disabled]="regenerating">
            <mat-icon>refresh</mat-icon>
            {{ regenerating ? ('summaries.regenerating' | translate) : ('summaries.regenerate' | translate) }}
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Version History -->
      <mat-card *ngIf="versions.length > 1" class="versions-card">
        <mat-card-header>
          <mat-card-title>{{ 'summaries.versionHistory' | translate }} ({{ versions.length }})</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-list>
            <mat-list-item *ngFor="let v of versions" (click)="switchVersion(v)" class="version-item"
                           [class.active-version]="v.id === summary.id">
              <div matListItemTitle>
                <span class="method-badge" [ngClass]="v.generation_method">
                  {{ v.generation_method === 'ai' ? ('reports.ai' | translate) : ('reports.fallback' | translate) }}
                </span>
                {{ v.generated_at | date:'medium' }}
                <span *ngIf="v.requested_by"> by {{ v.requested_by.first_name }} {{ v.requested_by.last_name }}</span>
              </div>
              <div matListItemLine class="version-preview">
                {{ v.summary_text | slice:0:120 }}{{ v.summary_text.length > 120 ? '...' : '' }}
              </div>
            </mat-list-item>
          </mat-list>
        </mat-card-content>
      </mat-card>
    </div>
  `,
    styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .detail-card { margin-bottom: 24px; }
    .summary-text { white-space: pre-line; line-height: 1.6; font-size: 15px; margin: 16px 0; }
    .structured-summary { margin: 16px 0; }
    .summary-section { margin-bottom: 16px; }
    .section-header { font-size: 16px; font-weight: 600; color: #1565c0; margin: 0 0 8px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    .section-content { line-height: 1.6; font-size: 15px; margin: 0; }
    .section-content p { margin: 4px 0; }
    .section-content ul { margin: 4px 0 4px 16px; padding-left: 8px; }
    .section-content li { margin: 2px 0; }
    .prompt-accordion { margin-top: 16px; display: block; }
    .prompt-text { white-space: pre-wrap; font-size: 13px; background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
    .metadata { margin-top: 16px; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-top: 8px; }
    .meta-info { margin-left: 12px; color: #666; }
    .error-msg { margin-top: 12px; padding: 8px 12px; background: #ffebee; border-radius: 4px; color: #c62828; }
    .type-chip {
      padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize; margin-right: 8px;
    }
    .type-chip.daily { background: #e3f2fd; color: #1565c0; }
    .type-chip.weekly { background: #f3e5f5; color: #7b1fa2; }
    .type-chip.on_demand { background: #e8eaf6; color: #283593; }
    .status-badge {
      padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize; margin-right: 8px;
    }
    .status-badge.completed { background: #e8f5e9; color: #2e7d32; }
    .status-badge.pending { background: #fff3e0; color: #e65100; }
    .status-badge.generating { background: #e3f2fd; color: #1565c0; }
    .status-badge.failed { background: #ffebee; color: #c62828; }
    .method-badge {
      padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; text-transform: uppercase; margin-right: 8px;
    }
    .method-badge.ai { background: #e8f5e9; color: #2e7d32; }
    .method-badge.fallback { background: #fff3e0; color: #e65100; }
    .versions-card { margin-top: 16px; }
    .version-item { cursor: pointer; }
    .version-item:hover { background: rgba(0, 0, 0, 0.04); }
    .active-version { background: rgba(25, 118, 210, 0.08); }
    .version-preview { color: #666; font-size: 13px; }

    .scope-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .scope-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 12px; border-radius: 16px; font-size: 13px; font-weight: 500;
    }
    .scope-badge.project { background: #e8eaf6; color: #283593; }
    .scope-badge.client { background: #fce4ec; color: #880e4f; }
    .scope-badge.focus { background: #fff8e1; color: #f57f17; }
    .scope-icon { font-size: 16px; width: 16px; height: 16px; }

    .charts-section { margin: 24px 0 16px 0; }
    .charts-title { font-size: 16px; font-weight: 600; color: #1565c0; margin: 16px 0; }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
    }
    .chart-card {
      background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px;
      padding: 16px;
    }
    .chart-card h4 { margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #424242; }
    .chart-card-wide { grid-column: 1 / -1; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SummaryDetailComponent implements OnInit, OnDestroy {
  summary: SummaryDetail | null = null;
  versions: SummaryVersion[] = [];
  loading = false;
  regenerating = false;
  isManager = false;
  hasChartData = false;

  // Chart data
  statusChartData: ChartData<'doughnut'> | null = null;
  priorityChartData: ChartData<'bar'> | null = null;
  engineerChartData: ChartData<'bar'> | null = null;
  clientChartData: ChartData<'bar'> | null = null;

  doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: { legend: { position: 'right' } },
  };

  barOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  stackedBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: { legend: { position: 'top' } },
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  private static readonly DAILY_ORDER = ['Overview', 'Watchlist'];
  private static readonly FULL_ORDER = ['Overview', 'Key Metrics', 'Highlights', 'Risks & Blockers', 'Recommendations'];
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private summaryService: SummaryService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.loadSummary(+params['id']);
    });
  }

  loadSummary(id: number): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.summaryService.getById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.summary = data;
        this.buildCharts(data.raw_data);
        this.loading = false;
        this.cdr.markForCheck();
        this.loadVersions(id);
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  loadVersions(id: number): void {
    this.summaryService.getVersions(id).pipe(takeUntil(this.destroy$)).subscribe((versions) => {
      this.versions = versions;
      this.cdr.markForCheck();
    });
  }

  switchVersion(version: SummaryVersion): void {
    this.router.navigate(['/reports/summaries', version.id]);
  }

  hasSections(): boolean {
    return !!this.summary?.sections && Object.keys(this.summary.sections).length > 0;
  }

  orderedSections(): string[] {
    if (!this.summary?.sections) return [];
    const present = Object.keys(this.summary.sections).filter(
      (k) => !!this.summary!.sections![k],
    );
    const preferred = this.summary.period_type === 'daily'
      ? SummaryDetailComponent.DAILY_ORDER
      : SummaryDetailComponent.FULL_ORDER;
    const ordered = preferred.filter((k) => present.includes(k));
    const extras = present.filter((k) => !preferred.includes(k));
    return [...ordered, ...extras];
  }

  renderMarkdown(text: string): string {
    let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const lines = html.split('\n');
    const result: string[] = [];
    let inList = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
        if (!inList) { result.push('<ul>'); inList = true; }
        const content = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
        result.push(`<li>${content}</li>`);
      } else {
        if (inList) { result.push('</ul>'); inList = false; }
        if (trimmed) result.push(`<p>${trimmed}</p>`);
      }
    }
    if (inList) result.push('</ul>');
    return result.join('');
  }

  regenerate(): void {
    if (!this.summary) return;
    this.regenerating = true;
    this.cdr.markForCheck();
    this.summaryService.regenerate(this.summary.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (newSummary) => {
        this.regenerating = false;
        this.snackBar.open(this.translate.instant('summaries.regenerationStarted'), this.translate.instant('common.view'), { duration: 5000 }).onAction().subscribe(() => {
          this.router.navigate(['/reports/summaries', newSummary.id]);
        });
        this.cdr.markForCheck();
        this.loadVersions(this.summary!.id);
      },
      error: () => {
        this.regenerating = false;
        this.snackBar.open(this.translate.instant('summaries.regenerationFailed'), this.translate.instant('common.dismiss'), { duration: 3000 });
        this.cdr.markForCheck();
      },
    });
  }

  // ---------- Chart building ----------

  private buildCharts(rawData: any): void {
    if (!rawData) { this.hasChartData = false; return; }

    const tasks = rawData.tasks || {};
    let anyChart = false;

    // Status distribution doughnut
    const byStatus = tasks.by_status || {};
    const statusLabels = Object.keys(byStatus).filter(k => byStatus[k] > 0);
    if (statusLabels.length > 0) {
      this.statusChartData = {
        labels: statusLabels.map(s => s.replace('_', ' ')),
        datasets: [{
          data: statusLabels.map(k => byStatus[k]),
          backgroundColor: statusLabels.map(s => this.statusColor(s)),
        }],
      };
      anyChart = true;
    }

    // Priority distribution bar
    const byPriority = tasks.by_priority || {};
    const prioLabels = Object.keys(byPriority).filter(k => byPriority[k] > 0);
    if (prioLabels.length > 0) {
      this.priorityChartData = {
        labels: prioLabels,
        datasets: [{
          data: prioLabels.map(k => byPriority[k]),
          backgroundColor: prioLabels.map(p => this.priorityColor(p)),
        }],
      };
      anyChart = true;
    }

    // Engineer workload stacked bar
    const engineers: any[] = rawData.by_engineer || [];
    if (engineers.length > 0) {
      const names = engineers.map(e => e.engineer_name);
      this.engineerChartData = {
        labels: names,
        datasets: [
          { label: 'Done', data: engineers.map(e => e.done || 0), backgroundColor: '#66bb6a' },
          { label: 'In Progress', data: engineers.map(e => e.in_progress || 0), backgroundColor: '#42a5f5' },
          { label: 'Overdue', data: engineers.map(e => e.overdue || 0), backgroundColor: '#ef5350' },
        ],
      };
      anyChart = true;
    }

    // Client activity bar
    const clients: any[] = rawData.by_client || [];
    if (clients.length > 0) {
      this.clientChartData = {
        labels: clients.map(c => c.client_name),
        datasets: [
          { label: 'Total', data: clients.map(c => c.total || 0), backgroundColor: '#7e57c2' },
          { label: 'Done', data: clients.map(c => c.done || 0), backgroundColor: '#66bb6a' },
        ],
      };
      // Override: grouped bar for clients
      this.clientChartData.datasets.forEach(ds => (ds as any).barPercentage = 0.8);
      anyChart = true;
    }

    this.hasChartData = anyChart;
  }

  private statusColor(status: string): string {
    const map: Record<string, string> = {
      created: '#90caf9', in_progress: '#42a5f5', waiting: '#ffca28',
      done: '#66bb6a', archived: '#bdbdbd',
    };
    return map[status] || '#9e9e9e';
  }

  private priorityColor(priority: string): string {
    const map: Record<string, string> = {
      low: '#81c784', medium: '#ffb74d', high: '#ff8a65', critical: '#ef5350',
    };
    return map[priority] || '#9e9e9e';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
