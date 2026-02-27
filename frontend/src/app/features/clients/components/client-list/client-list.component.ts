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
  standalone: true,
  imports: [CommonModule, RouterModule, MatTableModule, MatButtonModule, MatIconModule, MatPaginatorModule, SearchBarComponent, TranslateModule],
  template: `
    <div class="header">
      <h2>{{ 'clients.title' | translate }}</h2>
      <a mat-raised-button color="primary" routerLink="new"><mat-icon>add</mat-icon> {{ 'clients.newClient' | translate }}</a>
    </div>
    <app-search-bar [placeholder]="'clients.searchClients' | translate" (search)="onSearch($event)"></app-search-bar>
    <table mat-table [dataSource]="clients" class="full-width">
      <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>{{ 'common.name' | translate }}</th><td mat-cell *matCellDef="let c"><a [routerLink]="[c.id]">{{ c.name }}</a></td></ng-container>
      <ng-container matColumnDef="client_type"><th mat-header-cell *matHeaderCellDef>{{ 'clients.type' | translate }}</th><td mat-cell *matCellDef="let c">{{ c.client_type }}</td></ng-container>
      <ng-container matColumnDef="email"><th mat-header-cell *matHeaderCellDef>{{ 'common.email' | translate }}</th><td mat-cell *matCellDef="let c">{{ c.email }}</td></ng-container>
      <ng-container matColumnDef="phone"><th mat-header-cell *matHeaderCellDef>{{ 'common.phone' | translate }}</th><td mat-cell *matCellDef="let c">{{ c.phone }}</td></ng-container>
      <ng-container matColumnDef="tasks_count"><th mat-header-cell *matHeaderCellDef>{{ 'clients.tasksCount' | translate }}</th><td mat-cell *matCellDef="let c">{{ c.tasks_count }}</td></ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
    <mat-paginator [length]="totalCount" [pageSize]="20" (page)="onPage($event)"></mat-paginator>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .full-width { width: 100%; }
    a { text-decoration: none; color: #1976d2; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientListComponent implements OnInit, OnDestroy {
  clients: Client[] = [];
  totalCount = 0;
  columns = ['name', 'client_type', 'email', 'phone', 'tasks_count'];
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
