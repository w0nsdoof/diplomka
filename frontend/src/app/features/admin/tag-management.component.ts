import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TagService, Tag } from '../../core/services/tag.service';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';

@Component({
    selector: 'app-tag-management',
    imports: [
        CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
        MatFormFieldModule, MatInputModule, MatCardModule, MatSnackBarModule,
        SearchBarComponent, TranslateModule,
    ],
    template: `
    <div class="header">
      <h2>{{ 'tagAdmin.title' | translate }}</h2>
      <button mat-raised-button color="primary" (click)="showCreateForm = !showCreateForm">
        <mat-icon>add</mat-icon> {{ 'tagAdmin.newTag' | translate }}
      </button>
    </div>

    <mat-card *ngIf="showCreateForm" class="create-form">
      <mat-card-content>
        <h3>{{ 'tagAdmin.createTag' | translate }}</h3>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.name' | translate }}</mat-label>
            <input matInput [(ngModel)]="newTag.name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tagAdmin.color' | translate }}</mat-label>
            <input matInput [(ngModel)]="newTag.color" placeholder="#6c757d" />
          </mat-form-field>
          <div class="color-preview" [style.background]="newTag.color"></div>
        </div>
        <button mat-raised-button color="primary" (click)="createTag()" [disabled]="!newTag.name.trim()">{{ 'common.create' | translate }}</button>
        <button mat-button (click)="showCreateForm = false">{{ 'common.cancel' | translate }}</button>
      </mat-card-content>
    </mat-card>

    <app-search-bar [placeholder]="'tagAdmin.searchTags' | translate" (search)="onSearch($event)"></app-search-bar>

    <table mat-table [dataSource]="tags" class="full-width">
      <ng-container matColumnDef="color">
        <th mat-header-cell *matHeaderCellDef>{{ 'tagAdmin.color' | translate }}</th>
        <td mat-cell *matCellDef="let tag">
          <span class="color-swatch" [style.background]="tag.color"></span>
          {{ tag.color }}
        </td>
      </ng-container>

      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.name' | translate }}</th>
        <td mat-cell *matCellDef="let tag">{{ tag.name }}</td>
      </ng-container>

      <ng-container matColumnDef="slug">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.slug' | translate }}</th>
        <td mat-cell *matCellDef="let tag">{{ tag.slug }}</td>
      </ng-container>

      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | translate }}</th>
        <td mat-cell *matCellDef="let tag">
          <button mat-icon-button color="warn" (click)="deleteTag(tag)">
            <mat-icon>delete</mat-icon>
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>

    <div *ngIf="tags.length === 0" class="empty-state">{{ 'tagAdmin.noTags' | translate }}</div>
  `,
    styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .full-width { width: 100%; }
    .create-form { margin-bottom: 24px; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .form-row mat-form-field { flex: 1; min-width: 200px; }
    .color-preview { width: 36px; height: 36px; border-radius: 4px; border: 1px solid #ccc; }
    .color-swatch { display: inline-block; width: 16px; height: 16px; border-radius: 3px; vertical-align: middle; margin-right: 8px; border: 1px solid #ccc; }
    .empty-state { text-align: center; padding: 32px; color: #888; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TagManagementComponent implements OnInit, OnDestroy {
  tags: Tag[] = [];
  columns = ['color', 'name', 'slug', 'actions'];
  showCreateForm = false;
  newTag = { name: '', color: '#6c757d' };
  private searchTerm = '';
  private destroy$ = new Subject<void>();

  constructor(
    private tagService: TagService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.loadTags();
  }

  loadTags(): void {
    this.tagService.list(this.searchTerm || undefined).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.tags = res.results;
      this.cdr.markForCheck();
    });
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.loadTags();
  }

  createTag(): void {
    if (!this.newTag.name.trim()) return;
    this.tagService.create(this.newTag.name.trim(), this.newTag.color).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open(this.translate.instant('tagAdmin.tagCreated'), this.translate.instant('common.ok'), { duration: 3000 });
        this.showCreateForm = false;
        this.newTag = { name: '', color: '#6c757d' };
        this.loadTags();
        this.cdr.markForCheck();
      },
      error: (err) => {
        const msg = err.error?.name?.[0] || err.error?.detail || this.translate.instant('tagAdmin.failedCreate');
        this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 3000 });
      },
    });
  }

  deleteTag(tag: Tag): void {
    this.tagService.delete(tag.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open(this.translate.instant('tagAdmin.tagDeleted'), this.translate.instant('common.ok'), { duration: 3000 });
        this.loadTags();
      },
      error: (err) => {
        const msg = err.error?.detail || this.translate.instant('tagAdmin.failedDelete');
        this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 3000 });
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
