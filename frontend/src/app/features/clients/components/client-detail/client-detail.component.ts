import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ClientService, Client } from '../../../../core/services/client.service';

@Component({
    selector: 'app-client-detail',
    imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule, MatTableModule, TranslateModule],
    template: `
    <div *ngIf="client" class="client-detail">
      <div class="page-header">
        <h2>{{ client.name }}</h2>
        <a class="flat-btn-primary" [routerLink]="['/clients', client.id, 'edit']">
          <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
        </a>
      </div>

      <div class="detail-card flat-card">
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">{{ 'clients.type' | translate }}</span>
            <span class="detail-value">
              <span class="type-badge" [class]="'type-' + client.client_type">{{ client.client_type }}</span>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ 'common.email' | translate }}</span>
            <span class="detail-value">{{ client.email || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ 'common.phone' | translate }}</span>
            <span class="detail-value">{{ client.phone || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ 'clients.contactPerson' | translate }}</span>
            <span class="detail-value">{{ client.contact_person || '-' }}</span>
          </div>
        </div>
      </div>

      <h3 *ngIf="client.task_summary" class="summary-title">{{ 'clients.taskSummary' | translate }}</h3>
      <div *ngIf="client.task_summary" class="stats-grid">
        <div *ngFor="let item of summaryItems" class="stat-card">
          <div class="stat-value">{{ item.value }}</div>
          <div class="stat-label">{{ item.labelKey | translate }}</div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .client-detail { max-width: 960px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px;
    }
    .page-header h2 { font-size: 22px; font-weight: 700; margin: 0; }
    .page-header a { text-decoration: none; }

    .detail-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
    }
    .detail-item { display: flex; flex-direction: column; gap: 4px; }
    .detail-label { font-size: 13px; color: var(--text-secondary, #6b7280); }
    .detail-value { font-size: 15px; font-weight: 500; }

    .type-badge {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      font-size: 12px; font-weight: 500;
    }
    .type-company { background: #dbeafe; color: #1d4ed8; }
    .type-individual { background: #f3f4f6; color: #6b7280; }

    .summary-title { font-size: 16px; font-weight: 600; margin: 24px 0 16px 0; }

    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientDetailComponent implements OnInit, OnDestroy {
  client: Client | null = null;
  summaryItems: { labelKey: string; value: number }[] = [];
  private destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private clientService: ClientService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const id = +this.route.snapshot.params['id'];
    this.clientService.get(id).pipe(takeUntil(this.destroy$)).subscribe((client) => {
      this.client = client;
      if (client.task_summary) {
        this.summaryItems = [
          { labelKey: 'clients.total', value: client.task_summary.total },
          { labelKey: 'statuses.created', value: client.task_summary.created },
          { labelKey: 'statuses.in_progress', value: client.task_summary.in_progress },
          { labelKey: 'statuses.waiting', value: client.task_summary.waiting },
          { labelKey: 'statuses.done', value: client.task_summary.done },
          { labelKey: 'statuses.archived', value: client.task_summary.archived },
        ];
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
