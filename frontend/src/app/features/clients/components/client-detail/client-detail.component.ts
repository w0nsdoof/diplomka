import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { ClientService, Client } from '../../../../core/services/client.service';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule, MatTableModule],
  template: `
    <div *ngIf="client">
      <div class="header">
        <h2>{{ client.name }}</h2>
        <a mat-button [routerLink]="['/clients', client.id, 'edit']"><mat-icon>edit</mat-icon> Edit</a>
      </div>
      <mat-card>
        <mat-card-content>
          <p><strong>Type:</strong> {{ client.client_type }}</p>
          <p><strong>Email:</strong> {{ client.email || '-' }}</p>
          <p><strong>Phone:</strong> {{ client.phone || '-' }}</p>
          <p><strong>Contact Person:</strong> {{ client.contact_person || '-' }}</p>
        </mat-card-content>
      </mat-card>
      <h3 *ngIf="client.task_summary">Task Summary</h3>
      <div *ngIf="client.task_summary" class="summary-grid">
        <mat-card *ngFor="let item of summaryItems">
          <mat-card-content>
            <div class="stat-value">{{ item.value }}</div>
            <div class="stat-label">{{ item.label }}</div>
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
})
export class ClientDetailComponent implements OnInit {
  client: Client | null = null;
  summaryItems: { label: string; value: number }[] = [];

  constructor(private route: ActivatedRoute, private clientService: ClientService) {}

  ngOnInit(): void {
    const id = +this.route.snapshot.params['id'];
    this.clientService.get(id).subscribe((client) => {
      this.client = client;
      if (client.task_summary) {
        this.summaryItems = [
          { label: 'Total', value: client.task_summary.total },
          { label: 'Created', value: client.task_summary.created },
          { label: 'In Progress', value: client.task_summary.in_progress },
          { label: 'Waiting', value: client.task_summary.waiting },
          { label: 'Done', value: client.task_summary.done },
          { label: 'Archived', value: client.task_summary.archived },
        ];
      }
    });
  }
}
