import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatTableModule,
  ],
  template: `
    <h2>Reports</h2>
    <mat-card class="filter-card">
      <mat-card-content>
        <div class="filter-row">
          <mat-form-field appearance="outline">
            <mat-label>Date From</mat-label>
            <input matInput [matDatepicker]="fromPicker" [(ngModel)]="dateFrom" />
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
            <mat-datepicker #fromPicker></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Date To</mat-label>
            <input matInput [matDatepicker]="toPicker" [(ngModel)]="dateTo" />
            <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
            <mat-datepicker #toPicker></mat-datepicker>
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="loadReport()">Generate</button>
          <button mat-button (click)="exportPDF()"><mat-icon>picture_as_pdf</mat-icon> PDF</button>
          <button mat-button (click)="exportExcel()"><mat-icon>table_chart</mat-icon> Excel</button>
        </div>
      </mat-card-content>
    </mat-card>

    <div *ngIf="reportData" class="report-content">
      <div class="summary-grid">
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.total }}</div><div>Total</div></mat-card-content></mat-card>
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.created_in_period }}</div><div>Created</div></mat-card-content></mat-card>
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.closed_in_period }}</div><div>Closed</div></mat-card-content></mat-card>
        <mat-card><mat-card-content><div class="stat">{{ reportData.tasks.overdue }}</div><div>Overdue</div></mat-card-content></mat-card>
      </div>
    </div>
  `,
  styles: [`
    .filter-card { margin-bottom: 24px; }
    .filter-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .stat { font-size: 32px; font-weight: bold; text-align: center; }
    .report-content { margin-top: 24px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent implements OnDestroy {
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  reportData: any = null;
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

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
