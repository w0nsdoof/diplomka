import { importProvidersFrom } from '@angular/core';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { of, Observable } from 'rxjs';

const TRANSLATIONS: Record<string, any> = {};

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<any> {
    return of(TRANSLATIONS);
  }
}

export function provideTranslateTesting() {
  return importProvidersFrom(
    TranslateModule.forRoot({
      loader: { provide: TranslateLoader, useClass: FakeLoader },
    }),
  );
}
