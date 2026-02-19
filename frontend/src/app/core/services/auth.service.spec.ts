import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, TokenResponse, UserInfo } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  const fakePayload = { user_id: 1, email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'manager', organization_id: 1 };
  const fakeToken = 'header.' + btoa(JSON.stringify(fakePayload)) + '.signature';
  const fakeTokenResponse: TokenResponse = { access: fakeToken };

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    localStorage.clear();
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('user_info');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should POST credentials with withCredentials and store access token in memory', () => {
      service.login('test@example.com', 'pass123').subscribe((res) => {
        expect(res).toEqual(fakeTokenResponse);
      });

      const req = httpMock.expectOne('/api/auth/token/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@example.com', password: 'pass123' });
      expect(req.request.withCredentials).toBeTrue();
      req.flush(fakeTokenResponse);

      expect(service.getAccessToken()).toBe(fakeToken);
    });

    it('should decode JWT and update currentUser$', () => {
      let user: UserInfo | null = null;
      service.currentUser$.subscribe((u) => (user = u));

      service.login('test@example.com', 'pass123').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokenResponse);

      expect(user).toEqual(jasmine.objectContaining({
        id: 1,
        email: 'test@example.com',
        role: 'manager',
      }));
    });

    it('should store user info in localStorage', () => {
      service.login('test@example.com', 'pass123').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokenResponse);

      const stored = JSON.parse(localStorage.getItem('user_info')!);
      expect(stored.email).toBe('test@example.com');
    });

    it('should not store tokens in localStorage', () => {
      service.login('test@example.com', 'pass123').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokenResponse);

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should POST with withCredentials (cookie) and update access token', () => {
      const newPayload = { ...fakePayload, role: 'engineer' };
      const newToken = 'header.' + btoa(JSON.stringify(newPayload)) + '.signature';

      service.refreshToken().subscribe((res) => {
        expect(res.access).toBe(newToken);
      });

      const req = httpMock.expectOne('/api/auth/token/refresh/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ access: newToken });

      expect(service.getAccessToken()).toBe(newToken);
    });
  });

  describe('logout', () => {
    it('should clear in-memory token, localStorage, and navigate to login', () => {
      // First login to set state
      service.login('test@example.com', 'pass').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokenResponse);

      service.logout();

      // Flush the logout POST
      const req = httpMock.expectOne('/api/auth/logout/');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBeTrue();
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(service.getAccessToken()).toBeNull();
      expect(localStorage.getItem('user_info')).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should emit null on currentUser$', () => {
      let user: UserInfo | null = { id: 1 } as UserInfo;
      service.currentUser$.subscribe((u) => (user = u));

      service.logout();
      httpMock.expectOne('/api/auth/logout/').flush(null, { status: 204, statusText: 'No Content' });

      expect(user).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('should return null when not logged in', () => {
      expect(service.getAccessToken()).toBeNull();
    });

    it('should return in-memory token after login', () => {
      service.login('test@example.com', 'pass').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokenResponse);

      expect(service.getAccessToken()).toBe(fakeToken);
    });
  });

  describe('isLoggedIn', () => {
    it('should return false when no token in memory', () => {
      expect(service.isLoggedIn()).toBeFalse();
    });

    it('should return true after login', () => {
      service.login('test@example.com', 'pass').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokenResponse);

      expect(service.isLoggedIn()).toBeTrue();
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', () => {
      service.login('test@example.com', 'pass').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokenResponse);

      expect(service.hasRole('manager')).toBeTrue();
      expect(service.hasRole('engineer')).toBeFalse();
    });

    it('should return false when no user', () => {
      expect(service.hasRole('manager')).toBeFalse();
    });
  });

  describe('getCurrentUser', () => {
    it('should return null initially', () => {
      expect(service.getCurrentUser()).toBeNull();
    });

    it('should return user after login', () => {
      service.login('test@example.com', 'pass').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokenResponse);

      const user = service.getCurrentUser();
      expect(user?.email).toBe('test@example.com');
    });
  });

  describe('tryRestoreSession', () => {
    it('should return true when refresh succeeds', () => {
      let result: boolean | undefined;
      service.tryRestoreSession().subscribe((r) => (result = r));

      httpMock.expectOne('/api/auth/token/refresh/').flush(fakeTokenResponse);

      expect(result).toBeTrue();
      expect(service.isLoggedIn()).toBeTrue();
    });

    it('should return false when refresh fails', () => {
      let result: boolean | undefined;
      service.tryRestoreSession().subscribe((r) => (result = r));

      httpMock.expectOne('/api/auth/token/refresh/').flush(
        { detail: 'Token expired' },
        { status: 401, statusText: 'Unauthorized' },
      );

      expect(result).toBeFalse();
      expect(service.isLoggedIn()).toBeFalse();
    });
  });

  describe('initialization from localStorage', () => {
    it('should restore user from localStorage on creation', () => {
      const storedUser: UserInfo = { id: 5, email: 'stored@test.com', first_name: 'S', last_name: 'U', role: 'client', organization_id: 2 };
      localStorage.setItem('user_info', JSON.stringify(storedUser));

      const freshService = new (AuthService as any)(
        TestBed.inject(AuthService)['http'],
        router,
      );
      expect(freshService.getCurrentUser()).toEqual(storedUser);
    });
  });
});
