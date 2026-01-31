import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TaskService, TaskListItem } from '../../core/services/task.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatListModule, MatButtonModule, MatIconModule],
  template: `
    <h2>Calendar View</h2>
    <div class="calendar-controls">
      <button mat-icon-button (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
      <h3>{{ currentMonth | date:'MMMM yyyy' }}</h3>
      <button mat-icon-button (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
    </div>
    <div class="calendar-grid">
      <div *ngFor="let day of calendarDays" class="calendar-day" [class.other-month]="!day.isCurrentMonth" [class.today]="day.isToday">
        <div class="day-number">{{ day.date | date:'d' }}</div>
        <div *ngFor="let task of day.tasks" class="task-chip" [class]="'priority-' + task.priority">
          <a [routerLink]="['/tasks', task.id]">{{ task.title | slice:0:20 }}</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-controls { display: flex; align-items: center; gap: 16px; justify-content: center; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .calendar-day { min-height: 100px; border: 1px solid #e0e0e0; padding: 4px; }
    .day-number { font-weight: bold; margin-bottom: 4px; }
    .other-month { opacity: 0.4; }
    .today { background-color: #e3f2fd; }
    .task-chip { font-size: 11px; background: #f5f5f5; padding: 2px 4px; margin-bottom: 2px; border-radius: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .task-chip a { text-decoration: none; color: inherit; }
    .priority-critical { border-left: 3px solid #f44336; }
    .priority-high { border-left: 3px solid #ff9800; }
    .priority-medium { border-left: 3px solid #2196f3; }
    .priority-low { border-left: 3px solid #4caf50; }
  `],
})
export class CalendarComponent implements OnInit {
  currentMonth = new Date();
  calendarDays: { date: Date; isCurrentMonth: boolean; isToday: boolean; tasks: TaskListItem[] }[] = [];

  constructor(private taskService: TaskService) {}

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
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
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
    }).subscribe((res) => {
      for (const task of res.results) {
        const deadline = new Date(task.deadline);
        const day = this.calendarDays.find((d) => d.date.toDateString() === deadline.toDateString());
        if (day) day.tasks.push(task);
      }
    });
  }
}
