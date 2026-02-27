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
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule, MatTableModule, TranslateModule],
  template: `
    <div *ngIf="client">
      <div class="header">
        <h2>{{ client.name }}</h2>
        <a mat-button [routerLink]="['/clients', client.id, 'edit']"><mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}</a>
      </div>
      <mat-card>
        <mat-card-content>
          <p><strong>{{ 'clients.type' | translate }}:</strong> {{ client.client_type }}</p>
          <p><strong>{{ 'common.email' | translate }}:</strong> {{ client.email || '-' }}</p>
          <p><strong>{{ 'common.phone' | translate }}:</strong> {{ client.phone || '-' }}</p>
          <p><strong>{{ 'clients.contactPerson' | translate }}:</strong> {{ client.contact_person || '-' }}</p>
        </mat-card-content>
      </mat-card>
      <h3 *ngIf="client.task_summary">{{ 'clients.taskSummary' | translate }}</h3>
      <div *ngIf="client.task_summary" class="summary-grid">
        <mat-card *ngFor="let item of summaryItems">
          <mat-card-content>
            <div class="stat-value">{{ item.value }}</div>
            <div class="stat-label">{{ item.labelKey | translate }}</div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; margin-top: 12px; }
    .stat-value { font-size: 24px; font-weight: bold; text-align: center; }
    .stat-label { text-align: center; color: #757575; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
