import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, interval, switchMap, takeUntil, takeWhile } from 'rxjs';
import { TelegramService, TelegramStatus, TelegramLinkResponse } from '../../core/services/telegram.service';
import { ProfileService, UserProfile } from '../../core/services/profile.service';
import { LlmModelService, LLMModel } from '../../core/services/llm-model.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-settings',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatSlideToggleModule,
        MatSnackBarModule,
        MatDividerModule,
        MatProgressSpinnerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        TranslateModule,
    ],
    template: `
    <div class="settings-page">
      <!-- Profile card -->
      <mat-card class="profile-card">
        <mat-card-content>
          <!-- Avatar + identity header -->
          <div class="profile-header">
            <div class="avatar-preview" (click)="avatarInput.click()">
              <img *ngIf="profile?.avatar" [src]="profile!.avatar" alt="avatar" class="avatar-img">
              <div *ngIf="!profile?.avatar" class="avatar-placeholder">
                {{ profile?.first_name?.charAt(0) || '' }}{{ profile?.last_name?.charAt(0) || '' }}
              </div>
              <div class="avatar-overlay">
                <mat-icon>photo_camera</mat-icon>
              </div>
            </div>
            <input #avatarInput type="file" accept="image/*" hidden (change)="onAvatarSelected($event)">
            <div class="profile-identity">
              <h3 class="profile-name" *ngIf="profile">{{ profile.first_name }} {{ profile.last_name }}</h3>
              <span class="profile-email" *ngIf="profile">{{ profile.email }}</span>
              <button mat-button color="warn" *ngIf="profile?.avatar" class="remove-avatar-btn"
                      [disabled]="uploadingAvatar" (click)="onRemoveAvatar()">
                {{ 'settings.removeAvatar' | translate }}
              </button>
            </div>
          </div>

          <form *ngIf="profileForm" [formGroup]="profileForm" class="profile-form">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'settings.firstName' | translate }}</mat-label>
                <input matInput formControlName="first_name">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'settings.lastName' | translate }}</mat-label>
                <input matInput formControlName="last_name">
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'settings.jobTitle' | translate }}</mat-label>
              <input matInput formControlName="job_title"
                     [placeholder]="'settings.jobTitlePlaceholder' | translate">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'settings.skills' | translate }}</mat-label>
              <input matInput formControlName="skills"
                     [placeholder]="'settings.skillsPlaceholder' | translate">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'settings.bio' | translate }}</mat-label>
              <textarea matInput formControlName="bio" rows="3"
                        [placeholder]="'settings.bioPlaceholder' | translate"></textarea>
            </mat-form-field>

            <mat-divider></mat-divider>

            <div class="password-section">
              <p class="section-hint">{{ 'settings.passwordHint' | translate }}</p>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'settings.newPassword' | translate }}</mat-label>
                <input matInput type="password" formControlName="password">
              </mat-form-field>
            </div>
          </form>
        </mat-card-content>

        <mat-card-actions align="end">
          <button mat-flat-button color="primary"
                  [disabled]="savingProfile || !profileForm?.dirty"
                  (click)="onSaveProfile()">
            {{ 'common.save' | translate }}
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- AI Model card (managers only) -->
      <mat-card *ngIf="isManager" class="ai-model-card">
        <mat-card-header>
          <mat-icon mat-card-avatar class="ai-icon">psychology</mat-icon>
          <mat-card-title>{{ 'settings.aiModel' | translate }}</mat-card-title>
          <mat-card-subtitle>{{ 'settings.aiModelHint' | translate }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field appearance="outline" class="full-width" style="margin-top: 16px;">
            <mat-label>{{ 'settings.defaultModel' | translate }}</mat-label>
            <mat-select [value]="orgDefaultModelId" (selectionChange)="onOrgModelChange($event.value)">
              <mat-option [value]="null">{{ 'settings.systemDefault' | translate }}</mat-option>
              <mat-option *ngFor="let m of llmModels" [value]="m.id">{{ m.display_name }}</mat-option>
            </mat-select>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <!-- Telegram card -->
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

    .profile-card {
      margin-bottom: 24px;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 24px;
    }

    .avatar-preview {
      position: relative;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      overflow: hidden;
      cursor: pointer;
      flex-shrink: 0;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-placeholder {
      width: 100%;
      height: 100%;
      background: var(--primary-blue, #1a7cf4);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .avatar-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .avatar-overlay mat-icon {
      color: #fff;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .avatar-preview:hover .avatar-overlay {
      opacity: 1;
    }

    .profile-identity {
      flex: 1;
      min-width: 0;
    }

    .profile-name {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 2px;
      color: var(--text-primary, #1a1a1a);
    }

    .profile-email {
      font-size: 13px;
      color: var(--text-secondary, #6b7280);
    }

    .remove-avatar-btn {
      margin-top: 4px;
      font-size: 12px;
    }

    .profile-form {
      margin-top: 16px;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-row mat-form-field {
      flex: 1;
    }

    .full-width {
      width: 100%;
    }

    .password-section {
      margin-top: 16px;
    }

    .section-hint {
      font-size: 12px;
      color: var(--text-secondary, #6b7280);
      margin: 0 0 8px;
    }

    .ai-model-card {
      margin-bottom: 24px;
    }

    .ai-icon {
      background: #7c3aed;
      color: #fff;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
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
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit, OnDestroy {
  profile: UserProfile | null = null;
  profileForm!: FormGroup;
  savingProfile = false;
  uploadingAvatar = false;

  status: TelegramStatus | null = null;
  linkData: TelegramLinkResponse | null = null;
  linking = false;
  unlinking = false;
  togglingNotifications = false;

  // AI Model
  isManager = false;
  llmModels: LLMModel[] = [];
  orgDefaultModelId: number | null = null;

  private destroy$ = new Subject<void>();
  private stopPolling$ = new Subject<void>();

  constructor(
    private profileService: ProfileService,
    private telegramService: TelegramService,
    private authService: AuthService,
    private llmModelService: LlmModelService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');

    this.profileForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      job_title: [''],
      skills: [''],
      bio: [''],
      password: [''],
    });

    this.loadProfile();
    this.loadStatus();
    if (this.isManager) {
      this.loadLlmModels();
    }
  }

  private loadLlmModels(): void {
    this.llmModelService.listActive().pipe(takeUntil(this.destroy$)).subscribe({
      next: (models) => {
        this.llmModels = models;
        this.cdr.markForCheck();
      },
    });
    this.llmModelService.getOrgDefault().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.orgDefaultModelId = res.default_llm_model?.id ?? null;
        this.cdr.markForCheck();
      },
    });
  }

  onOrgModelChange(modelId: number | null): void {
    this.llmModelService.setOrgDefault(modelId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.orgDefaultModelId = res.default_llm_model?.id ?? null;
        this.snackBar.open(
          this.translate.instant('settings.modelSaved'),
          this.translate.instant('common.dismiss'),
          { duration: 3000 },
        );
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.stopPolling$.next();
    this.stopPolling$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProfile(): void {
    this.profileService.getProfile().pipe(takeUntil(this.destroy$)).subscribe((profile) => {
      this.profile = profile;
      this.profileForm.patchValue({
        first_name: profile.first_name,
        last_name: profile.last_name,
        job_title: profile.job_title,
        skills: profile.skills,
        bio: profile.bio,
        password: '',
      });
      this.profileForm.markAsPristine();
      this.cdr.markForCheck();
    });
  }

  onSaveProfile(): void {
    if (!this.profileForm.valid) return;

    this.savingProfile = true;
    const data: Record<string, string> = {};
    const controls = this.profileForm.controls;
    for (const key of Object.keys(controls)) {
      if (controls[key].dirty) {
        const value = controls[key].value;
        if (key === 'password' && !value) continue;
        data[key] = value;
      }
    }

    this.profileService.updateProfile(data).pipe(takeUntil(this.destroy$)).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.profileForm.patchValue({ password: '' });
        this.profileForm.markAsPristine();
        this.savingProfile = false;
        this.snackBar.open(
          this.translate.instant('settings.profileSaved'),
          this.translate.instant('common.dismiss'),
          { duration: 3000 },
        );
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingProfile = false;
        this.cdr.markForCheck();
      },
    });
  }

  onAvatarSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingAvatar = true;
    this.profileService.uploadAvatar(file).pipe(takeUntil(this.destroy$)).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.uploadingAvatar = false;
        this.snackBar.open(
          this.translate.instant('settings.avatarUpdated'),
          this.translate.instant('common.dismiss'),
          { duration: 3000 },
        );
        this.cdr.markForCheck();
      },
      error: () => {
        this.uploadingAvatar = false;
        this.cdr.markForCheck();
      },
    });
    (event.target as HTMLInputElement).value = '';
  }

  onRemoveAvatar(): void {
    this.uploadingAvatar = true;
    this.profileService.removeAvatar().pipe(takeUntil(this.destroy$)).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.uploadingAvatar = false;
        this.snackBar.open(
          this.translate.instant('settings.avatarRemoved'),
          this.translate.instant('common.dismiss'),
          { duration: 3000 },
        );
        this.cdr.markForCheck();
      },
      error: () => {
        this.uploadingAvatar = false;
        this.cdr.markForCheck();
      },
    });
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
        this.pollForLink();
      },
      error: () => {
        this.linking = false;
        this.cdr.markForCheck();
      },
    });
  }

  private pollForLink(): void {
    this.stopPolling$.next();
    const expiresAt = this.linkData?.expires_at ? new Date(this.linkData.expires_at).getTime() : 0;
    interval(3000).pipe(
      takeUntil(this.stopPolling$),
      takeUntil(this.destroy$),
      takeWhile(() => !!this.linkData && Date.now() < expiresAt),
      switchMap(() => this.telegramService.getStatus()),
    ).subscribe((status) => {
      if (status.is_linked) {
        this.status = status;
        this.linkData = null;
        this.stopPolling$.next();
        this.snackBar.open(this.translate.instant('settings.linkSuccess'), this.translate.instant('common.dismiss'), { duration: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  onUnlink(): void {
    this.stopPolling$.next();
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
