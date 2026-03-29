import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthService, UserInfo } from './core/services/auth.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    const authService = {
      ...jasmine.createSpyObj('AuthService', ['getCurrentUser']),
      currentUser$: new BehaviorSubject<UserInfo | null>(null).asObservable(),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'frontend' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('frontend');
  });

  it('should render a router-outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
