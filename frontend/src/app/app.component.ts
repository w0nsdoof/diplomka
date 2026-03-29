import { Component, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from './core/services/auth.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnDestroy {
  title = 'frontend';
  private destroy$ = new Subject<void>();

  constructor(private translate: TranslateService, private auth: AuthService) {
    this.translate.setDefaultLang('en');
    const saved = localStorage.getItem('app_language');
    this.translate.use(saved || 'en');

    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (user?.language) {
        this.translate.use(user.language);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
