import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ClientService, Client } from '../../../../core/services/client.service';
import { SearchBarComponent } from '../../../../shared/components/search-bar/search-bar.component';

@Component({
    selector: 'app-client-list',
    imports: [CommonModule, RouterModule, MatTableModule, MatButtonModule, MatIconModule, MatPaginatorModule, SearchBarComponent, TranslateModule],
    template: `
    <div class="page-header">
      <div>
        <h2>{{ 'companies.allCompanies' | translate }}</h2>
        <p class="page-subtitle">{{ 'clients.title' | translate }}</p>
      </div>
      <button class="flat-btn-primary" routerLink="new">
        <mat-icon>add</mat-icon> {{ 'clients.newClient' | translate }}
      </button>
    </div>
    <app-search-bar [placeholder]="'clients.searchClients' | translate" (search)="onSearch($event)"></app-search-bar>
    <table mat-table [dataSource]="clients" class="full-width">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.name' | translate }}</th>
        <td mat-cell *matCellDef="let c">
          <a [routerLink]="[c.id]" class="client-link">{{ c.name }}</a>
        </td>
      </ng-container>
      <ng-container matColumnDef="client_type">
        <th mat-header-cell *matHeaderCellDef>{{ 'clients.type' | translate }}</th>
        <td mat-cell *matCellDef="let c">
          <span class="type-badge" [class]="'type-' + c.client_type">
            {{ c.client_type === 'company' ? ('clients.company' | translate) : ('clients.individual' | translate) }}
          </span>
        </td>
      </ng-container>
      <ng-container matColumnDef="email">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.email' | translate }}</th>
        <td mat-cell *matCellDef="let c">{{ c.email }}</td>
      </ng-container>
      <ng-container matColumnDef="phone">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.phone' | translate }}</th>
        <td mat-cell *matCellDef="let c">{{ c.phone }}</td>
      </ng-container>
      <ng-container matColumnDef="employee_count">
        <th mat-header-cell *matHeaderCellDef>{{ 'clients.employeeCount' | translate }}</th>
        <td mat-cell *matCellDef="let c">{{ c.employee_count }}</td>
      </ng-container>
      <ng-container matColumnDef="tasks_count">
        <th mat-header-cell *matHeaderCellDef>{{ 'clients.tasksCount' | translate }}</th>
        <td mat-cell *matCellDef="let c">{{ c.tasks_count }}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | translate }}</th>
        <td mat-cell *matCellDef="let c">
          <a [routerLink]="[c.id, 'edit']" class="action-icon"><mat-icon>edit</mat-icon></a>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
    <mat-paginator [length]="totalCount" [pageSize]="20" (page)="onPage($event)"></mat-paginator>
  `,
    styles: [`
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px;
    }
    .page-header h2 { font-size: 22px; font-weight: 700; margin: 0; }
    .page-subtitle { font-size: 14px; color: var(--text-secondary, #6b7280); margin: 4px 0 0 0; }
    .full-width { width: 100%; }
    .client-link {
      text-decoration: none; color: var(--primary-blue, #1a7cf4); font-weight: 500;
    }
    .client-link:hover { text-decoration: underline; }

    .type-badge {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      font-size: 12px; font-weight: 500;
    }
    .type-company { background: #dbeafe; color: #1d4ed8; }
    .type-individual { background: #f3f4f6; color: #6b7280; }

    .action-icon {
      color: #9ca3af; cursor: pointer;
    }
    .action-icon:hover { color: var(--primary-blue, #1a7cf4); }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientListComponent implements OnInit, OnDestroy {
  clients: Client[] = [];
  totalCount = 0;
  columns = ['name', 'client_type', 'email', 'phone', 'employee_count', 'tasks_count', 'actions'];
  private page = 1;
  private searchTerm = '';
  private destroy$ = new Subject<void>();

  constructor(private clientService: ClientService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.clientService.list({ page: this.page, search: this.searchTerm } as any).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.clients = res.results;
      this.totalCount = res.count;
      this.cdr.markForCheck();
    });
  }

  onSearch(term: string): void { this.searchTerm = term; this.page = 1; this.load(); }
  onPage(event: PageEvent): void { this.page = event.pageIndex + 1; this.load(); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
