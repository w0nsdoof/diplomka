import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { LanguageSwitcherComponent } from '../../../shared/components/language-switcher/language-switcher.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    LanguageSwitcherComponent,
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <div class="lang-switcher">
          <app-language-switcher></app-language-switcher>
        </div>
        <mat-card-header>
          <mat-card-title>{{ 'auth.title' | translate }}</mat-card-title>
          <mat-card-subtitle>{{ 'auth.subtitle' | translate }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'auth.email' | translate }}</mat-label>
              <input matInput formControlName="email" type="email" />
              <mat-error *ngIf="loginForm.get('email')?.hasError('required')">{{ 'auth.emailRequired' | translate }}</mat-error>
              <mat-error *ngIf="loginForm.get('email')?.hasError('email')">{{ 'auth.invalidEmail' | translate }}</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'auth.password' | translate }}</mat-label>
              <input matInput formControlName="password" [type]="hidePassword ? 'password' : 'text'" />
              <button mat-icon-button matSuffix type="button" (click)="hidePassword = !hidePassword">
                <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="loginForm.get('password')?.hasError('required')">{{ 'auth.passwordRequired' | translate }}</mat-error>
            </mat-form-field>

            <div *ngIf="errorMessage" class="error-message">{{ errorMessage }}</div>

            <button mat-raised-button color="primary" type="submit" class="full-width" [disabled]="loading">
              <mat-spinner *ngIf="loading" diameter="20"></mat-spinner>
              <span *ngIf="!loading">{{ 'auth.signIn' | translate }}</span>
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #f5f5f5;
      }
      .login-card {
        width: 400px;
        padding: 24px;
        position: relative;
      }
      .lang-switcher {
        position: absolute;
        top: 8px;
        right: 8px;
      }
      .full-width {
        width: 100%;
      }
      mat-form-field {
        margin-bottom: 8px;
      }
      .error-message {
        color: #f44336;
        margin-bottom: 16px;
        text-align: center;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
