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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SummaryService, SummaryDetail, SummaryVersion } from '../../../core/services/summary.service';

@Component({
  selector: 'app-summary-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatCardModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatListModule, MatDividerModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="header-row">
      <h2>Summary Detail</h2>
      <a mat-button routerLink="/reports/summaries"><mat-icon>arrow_back</mat-icon> Back to History</a>
    </div>

    <div *ngIf="loading" style="text-align: center; padding: 48px;">
      <mat-spinner diameter="40"></mat-spinner>
    </div>

    <div *ngIf="summary && !loading">
      <mat-card class="detail-card">
        <mat-card-header>
          <mat-card-title>
            <span class="type-chip" [ngClass]="summary.period_type">{{ summary.period_type }}</span>
            {{ summary.period_start }} — {{ summary.period_end }}
          </mat-card-title>
          <mat-card-subtitle>
            <span class="status-badge" [ngClass]="summary.status">{{ summary.status }}</span>
            <span *ngIf="summary.generation_method" class="method-badge" [ngClass]="summary.generation_method">
              {{ summary.generation_method === 'ai' ? 'AI' : 'Fallback' }}
            </span>
            <span class="meta-info">Generated: {{ summary.generated_at | date:'medium' }}</span>
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p class="summary-text">{{ summary.summary_text }}</p>

          <mat-divider></mat-divider>

          <div class="metadata">
            <h4>Generation Details</h4>
            <div class="meta-grid">
              <div *ngIf="summary.llm_model"><strong>Model:</strong> {{ summary.llm_model }}</div>
              <div *ngIf="summary.prompt_tokens != null"><strong>Prompt tokens:</strong> {{ summary.prompt_tokens }}</div>
              <div *ngIf="summary.completion_tokens != null"><strong>Completion tokens:</strong> {{ summary.completion_tokens }}</div>
              <div *ngIf="summary.generation_time_ms != null"><strong>Generation time:</strong> {{ summary.generation_time_ms }}ms</div>
              <div *ngIf="summary.requested_by"><strong>Requested by:</strong> {{ summary.requested_by.first_name }} {{ summary.requested_by.last_name }}</div>
              <div><strong>Versions:</strong> {{ summary.version_count }}</div>
            </div>
            <div *ngIf="summary.error_message" class="error-msg">
              <strong>Error:</strong> {{ summary.error_message }}
            </div>
          </div>
        </mat-card-content>
        <mat-card-actions>
          <button mat-raised-button color="primary" (click)="regenerate()" [disabled]="regenerating">
            <mat-icon>refresh</mat-icon>
            {{ regenerating ? 'Regenerating...' : 'Regenerate' }}
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Version History -->
      <mat-card *ngIf="versions.length > 1" class="versions-card">
        <mat-card-header>
          <mat-card-title>Version History ({{ versions.length }})</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-list>
            <mat-list-item *ngFor="let v of versions" (click)="switchVersion(v)" class="version-item"
                           [class.active-version]="v.id === summary.id">
              <div matListItemTitle>
                <span class="method-badge" [ngClass]="v.generation_method">
                  {{ v.generation_method === 'ai' ? 'AI' : 'Fallback' }}
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryDetailComponent implements OnInit, OnDestroy {
  summary: SummaryDetail | null = null;
  versions: SummaryVersion[] = [];
  loading = false;
  regenerating = false;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private summaryService: SummaryService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
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

  regenerate(): void {
    if (!this.summary) return;
    this.regenerating = true;
    this.cdr.markForCheck();
    this.summaryService.regenerate(this.summary.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (newSummary) => {
        this.regenerating = false;
        this.snackBar.open('Regeneration started', 'View', { duration: 5000 }).onAction().subscribe(() => {
          this.router.navigate(['/reports/summaries', newSummary.id]);
        });
        this.cdr.markForCheck();
        // Reload versions to show the new one
        this.loadVersions(this.summary!.id);
      },
      error: () => {
        this.regenerating = false;
        this.snackBar.open('Regeneration failed', 'Dismiss', { duration: 3000 });
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
