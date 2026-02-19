import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj('AuthService', ['login', 'getCurrentUser']);
    router = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form validation', () => {
    it('should have invalid form initially', () => {
      expect(component.loginForm.valid).toBeFalse();
    });

    it('should require email', () => {
      const email = component.loginForm.get('email')!;
      expect(email.hasError('required')).toBeTrue();
    });

    it('should validate email format', () => {
      const email = component.loginForm.get('email')!;
      email.setValue('notanemail');
      expect(email.hasError('email')).toBeTrue();

      email.setValue('valid@test.com');
      expect(email.valid).toBeTrue();
    });

    it('should require password', () => {
      const password = component.loginForm.get('password')!;
      expect(password.hasError('required')).toBeTrue();

      password.setValue('secret');
      expect(password.valid).toBeTrue();
    });

    it('should be valid with proper email and password', () => {
      component.loginForm.patchValue({ email: 'test@test.com', password: 'pass' });
      expect(component.loginForm.valid).toBeTrue();
    });
  });

  describe('onSubmit', () => {
    it('should not call login when form is invalid', () => {
      component.onSubmit();
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should call login with form values', () => {
      authService.login.and.returnValue(of({ access: 'a', refresh: 'r' }));
      authService.getCurrentUser.and.returnValue({ id: 1, email: '', first_name: '', last_name: '', role: 'manager', organization_id: 1 });

      component.loginForm.patchValue({ email: 'test@test.com', password: 'pass' });
      component.onSubmit();

      expect(authService.login).toHaveBeenCalledWith('test@test.com', 'pass');
    });

    it('should set loading=true during request', () => {
      authService.login.and.returnValue(of({ access: 'a', refresh: 'r' }));
      authService.getCurrentUser.and.returnValue({ id: 1, email: '', first_name: '', last_name: '', role: 'manager', organization_id: 1 });

      component.loginForm.patchValue({ email: 'test@test.com', password: 'pass' });
      component.onSubmit();

      // Loading is set to true but immediately resolves since we use `of()`
      expect(component.loading).toBeTrue();
    });

    it('should navigate to /portal for client role', () => {
      authService.login.and.returnValue(of({ access: 'a', refresh: 'r' }));
      authService.getCurrentUser.and.returnValue({ id: 1, email: '', first_name: '', last_name: '', role: 'client', organization_id: 2 });

      component.loginForm.patchValue({ email: 'client@test.com', password: 'pass' });
      component.onSubmit();

      expect(router.navigate).toHaveBeenCalledWith(['/portal']);
    });

    it('should navigate to /tasks for non-client roles', () => {
      authService.login.and.returnValue(of({ access: 'a', refresh: 'r' }));
      authService.getCurrentUser.and.returnValue({ id: 1, email: '', first_name: '', last_name: '', role: 'engineer', organization_id: 3 });

      component.loginForm.patchValue({ email: 'eng@test.com', password: 'pass' });
      component.onSubmit();

      expect(router.navigate).toHaveBeenCalledWith(['/tasks']);
    });

    it('should display error message on login failure', () => {
      authService.login.and.returnValue(throwError(() => ({
        error: { detail: 'Invalid credentials' },
      })));

      component.loginForm.patchValue({ email: 'bad@test.com', password: 'wrong' });
      component.onSubmit();

      expect(component.errorMessage).toBe('Invalid credentials');
      expect(component.loading).toBeFalse();
    });

    it('should show default error message when no detail', () => {
      authService.login.and.returnValue(throwError(() => ({ error: {} })));

      component.loginForm.patchValue({ email: 'bad@test.com', password: 'wrong' });
      component.onSubmit();

      expect(component.errorMessage).toBe('Login failed. Please try again.');
    });
  });

  describe('template', () => {
    it('should show error message in DOM', () => {
      authService.login.and.returnValue(throwError(() => ({
        error: { detail: 'Test error' },
      })));

      component.loginForm.patchValue({ email: 'bad@test.com', password: 'wrong' });
      component.onSubmit();
      fixture.detectChanges();

      const el = fixture.nativeElement.querySelector('.error-message');
      expect(el?.textContent).toContain('Test error');
    });
  });
});
