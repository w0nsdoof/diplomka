import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { TelegramService, TelegramStatus, TelegramLinkResponse } from '../../core/services/telegram.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  template: `
    <div class="settings-page">
      <mat-card class="telegram-card">
        <mat-card-header>
          <mat-icon mat-card-avatar class="telegram-icon">send</mat-icon>
          <mat-card-title>{{ 'settings.telegramIntegration' | translate }}</mat-card-title>
          <mat-card-subtitle>
            <span *ngIf="status?.is_linked" class="status-badge linked">
              {{ 'settings.linked' | translate }}
            </span>
            <span *ngIf="!status?.is_linked" class="status-badge not-linked">
              {{ 'settings.notLinked' | translate }}
            </span>
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <!-- Linked state -->
          <div *ngIf="status?.is_linked" class="linked-info">
            <div class="info-row" *ngIf="status!.username">
              <span class="label">{{ 'settings.username' | translate }}:</span>
              <span class="value">{{'@'}}{{ status!.username }}</span>
            </div>
            <div class="info-row" *ngIf="status!.linked_at">
              <span class="label">{{ 'settings.linkedAt' | translate }}:</span>
              <span class="value">{{ status!.linked_at | date:'medium' }}</span>
            </div>

            <div *ngIf="!status!.is_active" class="warning-banner">
              <mat-icon>warning</mat-icon>
              <span>{{ 'settings.botBlocked' | translate }}</span>
            </div>

            <mat-divider></mat-divider>

            <div class="toggle-row">
              <div class="toggle-label">
                <mat-icon>notifications</mat-icon>
                <span>{{ 'settings.notifications' | translate }}</span>
              </div>
              <mat-slide-toggle
                [checked]="status!.telegram_notifications_enabled"
                [disabled]="!status!.is_active || togglingNotifications"
                (change)="onToggleNotifications($event.checked)">
              </mat-slide-toggle>
            </div>
          </div>

          <!-- Not linked state -->
          <div *ngIf="!status?.is_linked && !linkData" class="not-linked-info">
            <p>{{ 'settings.linkInstructions' | translate }}</p>
          </div>

          <!-- Link data (deep link shown) -->
          <div *ngIf="linkData" class="link-data">
            <a [href]="linkData.deep_link" target="_blank" rel="noopener" class="telegram-deep-link">
              <mat-icon>open_in_new</mat-icon>
              {{ 'settings.openInTelegram' | translate }}
            </a>
            <div class="code-fallback">
              <p class="fallback-hint">{{ 'settings.codeFallbackHint' | translate }}</p>
              <div class="code-box" (click)="copyCode()">
                <code>{{ linkData.code }}</code>
                <mat-icon class="copy-icon">content_copy</mat-icon>
              </div>
            </div>
            <p class="expires-text">
              {{ 'settings.codeExpires' | translate }}: {{ linkData.expires_at | date:'mediumTime' }}
            </p>
          </div>
        </mat-card-content>

        <mat-card-actions align="end">
          <button *ngIf="status?.is_linked"
                  mat-button color="warn"
                  [disabled]="unlinking"
                  (click)="onUnlink()">
            <mat-icon>link_off</mat-icon>
            {{ 'settings.unlinkTelegram' | translate }}
          </button>

          <button *ngIf="!status?.is_linked"
                  mat-flat-button color="primary"
                  [disabled]="linking"
                  (click)="onLink()">
            <mat-icon>link</mat-icon>
            {{ 'settings.linkTelegram' | translate }}
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .settings-page {
      max-width: 600px;
    }

    .telegram-card {
      margin-bottom: 24px;
    }

    .telegram-icon {
      background: #0088cc;
      color: #fff;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-badge.linked {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-badge.not-linked {
      background: #f5f5f5;
      color: #757575;
    }

    .linked-info {
      margin-top: 16px;
    }

    .info-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .info-row .label {
      color: var(--text-secondary, #6b7280);
    }

    .info-row .value {
      font-weight: 500;
    }

    .warning-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #fff3e0;
      border-radius: 8px;
      margin: 12px 0;
      color: #e65100;
      font-size: 14px;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 0;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
    }

    .not-linked-info p {
      margin: 16px 0;
      color: var(--text-secondary, #6b7280);
      font-size: 14px;
    }

    .link-data {
      margin: 16px 0;
      text-align: center;
    }

    .telegram-deep-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background: #0088cc;
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      transition: background 0.2s;
    }

    .telegram-deep-link:hover {
      background: #006699;
    }

    .code-fallback {
      margin-top: 12px;
    }

    .fallback-hint {
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
      margin: 0 0 6px;
    }

    .code-box {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .code-box:hover {
      background: #eeeeee;
    }

    .code-box code {
      font-size: 13px;
      word-break: break-all;
    }

    .copy-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--text-secondary, #6b7280);
    }

    .expires-text {
      margin-top: 8px;
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
    }

    mat-divider {
      margin: 12px 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit, OnDestroy {
  status: TelegramStatus | null = null;
  linkData: TelegramLinkResponse | null = null;
  linking = false;
  unlinking = false;
  togglingNotifications = false;
  private destroy$ = new Subject<void>();

  constructor(
    private telegramService: TelegramService,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadStatus(): void {
    this.telegramService.getStatus().pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.status = status;
      this.cdr.markForCheck();
    });
  }

  onLink(): void {
    this.linking = true;
    this.linkData = null;
    this.telegramService.generateLink().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.linkData = data;
        this.linking = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.linking = false;
        this.cdr.markForCheck();
      },
    });
  }

  onUnlink(): void {
    this.unlinking = true;
    this.telegramService.unlink().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open(this.translate.instant('settings.unlinkSuccess'), this.translate.instant('common.dismiss'), { duration: 3000 });
        this.linkData = null;
        this.unlinking = false;
        this.loadStatus();
      },
      error: () => {
        this.unlinking = false;
        this.cdr.markForCheck();
      },
    });
  }

  copyCode(): void {
    if (this.linkData?.code) {
      navigator.clipboard.writeText(this.linkData.code).then(() => {
        this.snackBar.open(
          this.translate.instant('settings.codeCopied'),
          this.translate.instant('common.dismiss'),
          { duration: 2000 },
        );
      });
    }
  }

  onToggleNotifications(enabled: boolean): void {
    this.togglingNotifications = true;
    this.telegramService.toggleNotifications(enabled).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        if (this.status) {
          this.status = { ...this.status, telegram_notifications_enabled: result.telegram_notifications_enabled };
        }
        this.snackBar.open(this.translate.instant('settings.notificationsToggled'), this.translate.instant('common.dismiss'), { duration: 3000 });
        this.togglingNotifications = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.togglingNotifications = false;
        this.cdr.markForCheck();
      },
    });
  }
}
