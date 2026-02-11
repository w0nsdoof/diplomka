import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatListModule, MatIconModule],
  template: `
    <div *ngIf="ticket">
      <h2>{{ ticket.title }}</h2>
      <div class="meta">
        <mat-chip>{{ ticket.status }}</mat-chip>
        <mat-chip>{{ ticket.priority }}</mat-chip>
        <span>Deadline: {{ ticket.deadline | date:'mediumDate' }}</span>
      </div>
      <mat-card>
        <mat-card-content><p>{{ ticket.description }}</p></mat-card-content>
      </mat-card>
      <h3>Comments</h3>
      <mat-list>
        <mat-list-item *ngFor="let c of ticket.comments">
          <div>
            <strong>{{ c.author.first_name }} {{ c.author.last_name }}</strong>
            <span class="date"> - {{ c.created_at | date:'medium' }}</span>
          </div>
          <p>{{ c.content }}</p>
        </mat-list-item>
      </mat-list>
      <h3>Attachments</h3>
      <mat-list>
        <mat-list-item *ngFor="let a of ticket.attachments">
          <mat-icon matListItemIcon>attach_file</mat-icon>
          <span matListItemTitle>{{ a.filename }}</span>
        </mat-list-item>
      </mat-list>
    </div>
  `,
  styles: [`
    .meta { display: flex; gap: 12px; align-items: center; margin: 12px 0; }
    .date { color: #757575; font-size: 12px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketDetailComponent implements OnInit, OnDestroy {
  ticket: any = null;
  private destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.http.get(`${environment.apiUrl}/portal/tickets/${id}/`).pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.ticket = data;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
