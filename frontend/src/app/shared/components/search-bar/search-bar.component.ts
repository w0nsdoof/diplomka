import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatIconModule],
  template: `
    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Search</mat-label>
      <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearch($event)" [placeholder]="placeholder" />
      <mat-icon matSuffix>search</mat-icon>
    </mat-form-field>
  `,
  styles: [`.search-field { width: 100%; }`],
})
export class SearchBarComponent {
  @Input() placeholder = 'Search...';
  @Output() search = new EventEmitter<string>();
  searchTerm = '';
  private searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe((term) => {
      this.search.emit(term);
    });
  }

  onSearch(term: string): void {
    this.searchSubject.next(term);
  }
}
