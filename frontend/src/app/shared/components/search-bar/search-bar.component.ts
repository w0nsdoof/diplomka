import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatIconModule, TranslateModule],
  template: `
    <mat-form-field appearance="outline" class="search-field">
      <mat-label>{{ 'common.search' | translate }}</mat-label>
      <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearch($event)" [placeholder]="placeholder" />
      <mat-icon matSuffix>search</mat-icon>
    </mat-form-field>
  `,
  styles: [`.search-field { width: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarComponent implements OnDestroy {
  @Input() placeholder = 'Search...';
  @Output() search = new EventEmitter<string>();
  searchTerm = '';
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor() {
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe((term) => {
      this.search.emit(term);
    });
  }

  onSearch(term: string): void {
    this.searchSubject.next(term);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
