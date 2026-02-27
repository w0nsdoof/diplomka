import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, TranslateModule],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="langMenu">
      <mat-icon>language</mat-icon>
    </button>
    <mat-menu #langMenu="matMenu">
      <button mat-menu-item (click)="switchLang('en')">
        {{ 'language.en' | translate }}
      </button>
      <button mat-menu-item (click)="switchLang('ru')">
        {{ 'language.ru' | translate }}
      </button>
    </mat-menu>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcherComponent {
  constructor(private translate: TranslateService) {}

  switchLang(lang: string): void {
    this.translate.use(lang);
    localStorage.setItem('app_language', lang);
  }
}
