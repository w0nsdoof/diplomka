import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { TaskService, TaskListItem } from '../../core/services/task.service';

@Component({
    selector: 'app-calendar',
    imports: [CommonModule, RouterModule, MatCardModule, MatListModule, MatButtonModule, MatIconModule, TranslateModule],
    template: `
    <div class="page-header">
      <h2>{{ 'calendar.title' | translate }}</h2>
    </div>
    <div class="calendar-card flat-card">
      <div class="calendar-controls">
        <button class="nav-btn" (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
        <h3 class="month-title">{{ currentMonth | date:'MMMM yyyy' }}</h3>
        <button class="nav-btn" (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
      </div>
      <div class="weekday-header">
        <div class="weekday" *ngFor="let day of weekDays">{{ day }}</div>
      </div>
      <div class="calendar-grid">
        <div *ngFor="let day of calendarDays" class="calendar-day"
             [class.other-month]="!day.isCurrentMonth"
             [class.today]="day.isToday">
          <div class="day-number">{{ day.date | date:'d' }}</div>
          <div *ngFor="let task of day.tasks" class="task-chip" [class]="'priority-border-' + task.priority">
            <a [routerLink]="['/tasks', task.id]">{{ task.title | slice:0:20 }}</a>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px;
    }
    .page-header h2 { font-size: 22px; font-weight: 700; margin: 0; }

    .calendar-card { padding: 24px; }

    .calendar-controls {
      display: flex; align-items: center; gap: 16px; justify-content: center;
      margin-bottom: 20px;
    }
    .nav-btn {
      background: none; border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 8px; cursor: pointer; padding: 4px 8px;
      display: flex; align-items: center; color: var(--text-secondary, #6b7280);
    }
    .nav-btn:hover { background: #f9fafb; }
    .month-title { margin: 0; font-size: 18px; font-weight: 600; min-width: 200px; text-align: center; }

    .weekday-header {
      display: grid; grid-template-columns: repeat(7, 1fr);
      border-bottom: 1px solid var(--border-color, #e5e7eb);
      margin-bottom: 2px;
    }
    .weekday {
      text-align: center; font-size: 13px; font-weight: 600;
      color: var(--text-secondary, #6b7280); padding: 8px 0;
    }

    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
    .calendar-day {
      min-height: 100px; border: 1px solid var(--border-color, #e5e7eb);
      padding: 6px; border-radius: 4px;
    }
    .day-number { font-weight: 600; margin-bottom: 4px; font-size: 14px; }
    .other-month { opacity: 0.35; }
    .today { background-color: #eff6ff; }
    .today .day-number { color: var(--primary-blue, #1a7cf4); }

    .task-chip {
      font-size: 11px; background: #f8fafc; padding: 3px 6px;
      margin-bottom: 2px; border-radius: 4px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .task-chip a { text-decoration: none; color: var(--text-primary, #1a1a1a); }
    .task-chip a:hover { color: var(--primary-blue, #1a7cf4); }
    .priority-border-critical { border-left: 3px solid #f44336; }
    .priority-border-high { border-left: 3px solid #ff9800; }
    .priority-border-medium { border-left: 3px solid #2196f3; }
    .priority-border-low { border-left: 3px solid #4caf50; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarComponent implements OnInit, OnDestroy {
  currentMonth = new Date();
  calendarDays: { date: Date; isCurrentMonth: boolean; isToday: boolean; tasks: TaskListItem[] }[] = [];
  weekDays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
  private destroy$ = new Subject<void>();

  constructor(private taskService: TaskService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.buildCalendar(); }

  prevMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
    this.buildCalendar();
  }

  nextMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
    this.buildCalendar();
  }

  private buildCalendar(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    // Adjust to start on Monday
    const dayOfWeek = startDate.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - diff);
    const endDate = new Date(lastDay);
    const endDayOfWeek = endDate.getDay();
    const endDiff = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
    endDate.setDate(endDate.getDate() + endDiff);
    const today = new Date();

    this.calendarDays = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      this.calendarDays.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        isToday: current.toDateString() === today.toDateString(),
        tasks: [],
      });
      current.setDate(current.getDate() + 1);
    }

    this.taskService.list({
      deadline_from: startDate.toISOString(),
      deadline_to: endDate.toISOString(),
      page_size: 100,
    }).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      for (const task of res.results) {
        const deadline = new Date(task.deadline);
        const day = this.calendarDays.find((d) => d.date.toDateString() === deadline.toDateString());
        if (day) day.tasks.push(task);
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
