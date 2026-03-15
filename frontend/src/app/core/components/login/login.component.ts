import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { LanguageSwitcherComponent } from '../../../shared/components/language-switcher/language-switcher.component';

@Component({
    selector: 'app-login',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TranslateModule,
        LanguageSwitcherComponent,
    ],
    template: `
    <div class="login-container">
      <div class="login-card">
        <div class="lang-switcher">
          <app-language-switcher></app-language-switcher>
        </div>
        <h1 class="login-title">{{ 'auth.welcome' | translate }}</h1>
        <p class="login-subtitle">{{ 'auth.subtitle' | translate }}</p>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label class="flat-input-label">{{ 'auth.emailOrPhone' | translate }}</label>
            <input class="flat-input" formControlName="email" type="email" [placeholder]="'auth.emailOrPhone' | translate" />
            <span class="field-error" *ngIf="loginForm.get('email')?.touched && loginForm.get('email')?.hasError('required')">
              {{ 'auth.emailRequired' | translate }}
            </span>
            <span class="field-error" *ngIf="loginForm.get('email')?.touched && loginForm.get('email')?.hasError('email')">
              {{ 'auth.invalidEmail' | translate }}
            </span>
          </div>

          <div class="form-group">
            <label class="flat-input-label">{{ 'auth.password' | translate }}</label>
            <div class="password-wrap">
              <input class="flat-input" formControlName="password" [type]="hidePassword ? 'password' : 'text'" [placeholder]="'auth.password' | translate" />
              <button type="button" class="password-toggle" (click)="hidePassword = !hidePassword">
                <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </div>
            <span class="field-error" *ngIf="loginForm.get('password')?.touched && loginForm.get('password')?.hasError('required')">
              {{ 'auth.passwordRequired' | translate }}
            </span>
          </div>

          <div class="forgot-row">
            <a class="forgot-link">{{ 'auth.forgotPassword' | translate }}</a>
          </div>

          <div *ngIf="errorMessage" class="error-message">{{ errorMessage }}</div>

          <button class="flat-btn-primary login-btn" type="submit" [disabled]="loading">
            <mat-spinner *ngIf="loading" diameter="20"></mat-spinner>
            <span *ngIf="!loading">{{ 'auth.signIn' | translate }}</span>
          </button>
        </form>
      </div>
    </div>
  `,
    styles: [
        `
      .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: var(--bg-gray, #f9f9f9);
      }

      .login-card {
        width: 420px;
        padding: 40px;
        background: #fff;
        border-radius: var(--border-radius-card, 12px);
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
        position: relative;
      }

      .lang-switcher {
        position: absolute;
        top: 16px;
        right: 16px;
      }

      .login-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--text-primary, #1a1a1a);
        margin: 0 0 8px 0;
      }

      .login-subtitle {
        font-size: 14px;
        color: var(--text-secondary, #6b7280);
        margin: 0 0 32px 0;
      }

      .form-group {
        margin-bottom: 20px;
      }

      .password-wrap {
        position: relative;
      }

      .password-wrap .flat-input {
        padding-right: 48px;
      }

      .password-toggle {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        color: #9ca3af;
        display: flex;
        padding: 0;
      }

      .password-toggle mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .forgot-row {
        text-align: right;
        margin-bottom: 24px;
      }

      .forgot-link {
        font-size: 13px;
        color: var(--primary-blue, #1a7cf4);
        cursor: pointer;
        text-decoration: none;
      }

      .forgot-link:hover {
        text-decoration: underline;
      }

      .field-error {
        display: block;
        color: #ef4444;
        font-size: 12px;
        margin-top: 4px;
      }

      .error-message {
        color: #ef4444;
        margin-bottom: 16px;
        text-align: center;
        font-size: 14px;
      }

      .login-btn {
        width: 100%;
        padding: 14px;
        font-size: 16px;
      }
    `,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnDestroy {
  loginForm: FormGroup;
  hidePassword = true;
  loading = false;
  errorMessage = '';
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;
    this.loading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;
    this.authService.login(email, password).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        const user = this.authService.getCurrentUser();
        if (user?.role === 'superadmin') {
          this.router.navigate(['/platform/organizations']);
        } else if (user?.role === 'client') {
          this.router.navigate(['/portal']);
        } else {
          this.router.navigate(['/tasks']);
        }
      },
      error: (err) => {
        this.loading = false;
        const detail = err.error?.detail;
        const translated = detail ? this.translate.instant(`backendErrors.${detail}`) : null;
        this.errorMessage = (translated && translated !== `backendErrors.${detail}`) ? translated : (detail || this.translate.instant('auth.loginFailed'));
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
