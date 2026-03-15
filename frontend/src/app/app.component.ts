import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  title = 'frontend';

  constructor(private translate: TranslateService) {
    this.translate.setDefaultLang('en');
    const saved = localStorage.getItem('app_language');
    this.translate.use(saved || 'en');
  }
}
