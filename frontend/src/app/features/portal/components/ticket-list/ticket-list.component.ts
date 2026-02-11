import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatTableModule, MatChipsModule, MatPaginatorModule],
  template: `
    <h2>My Tickets</h2>
    <table mat-table [dataSource]="tickets" class="full-width">
      <ng-container matColumnDef="title"><th mat-header-cell *matHeaderCellDef>Title</th><td mat-cell *matCellDef="let t"><a [routerLink]="[t.id]">{{ t.title }}</a></td></ng-container>
      <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Status</th><td mat-cell *matCellDef="let t"><mat-chip>{{ t.status }}</mat-chip></td></ng-container>
      <ng-container matColumnDef="priority"><th mat-header-cell *matHeaderCellDef>Priority</th><td mat-cell *matCellDef="let t">{{ t.priority }}</td></ng-container>
      <ng-container matColumnDef="deadline"><th mat-header-cell *matHeaderCellDef>Deadline</th><td mat-cell *matCellDef="let t">{{ t.deadline | date:'mediumDate' }}</td></ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
    <mat-paginator [length]="total" [pageSize]="20" (page)="onPage($event)"></mat-paginator>
  `,
  styles: [`.full-width { width: 100%; } a { text-decoration: none; color: #1976d2; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketListComponent implements OnInit, OnDestroy {
  tickets: any[] = [];
  total = 0;
  columns = ['title', 'status', 'priority', 'deadline'];
  private page = 1;
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    const params = new HttpParams().set('page', String(this.page));
    this.http.get<any>(`${environment.apiUrl}/portal/tickets/`, { params }).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.tickets = res.results;
      this.total = res.count;
      this.cdr.markForCheck();
    });
  }

  onPage(event: PageEvent): void { this.page = event.pageIndex + 1; this.load(); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
