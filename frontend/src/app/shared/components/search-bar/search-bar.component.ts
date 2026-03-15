import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
    selector: 'app-search-bar',
    imports: [CommonModule, FormsModule, MatIconModule, TranslateModule],
    template: `
    <div class="search-wrap">
      <mat-icon class="search-icon">search</mat-icon>
      <input class="search-input"
             [(ngModel)]="searchTerm"
             (ngModelChange)="onSearch($event)"
             [placeholder]="placeholder" />
    </div>
  `,
    styles: [`
    .search-wrap {
      position: relative;
      margin-bottom: 16px;
    }

    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .search-input {
      width: 100%;
      padding: 10px 16px 10px 44px;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 8px;
      background: #fff;
      font-size: 14px;
      color: var(--text-primary, #1a1a1a);
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;

      &::placeholder {
        color: #9ca3af;
      }

      &:focus {
        border-color: var(--primary-blue, #1a7cf4);
      }
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
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
