import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let snackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(() => {
    snackBar = jasmine.createSpyObj('MatSnackBar', ['open']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should pass through successful requests', () => {
    httpClient.get('/api/test/').subscribe((res) => {
      expect(res).toEqual({ ok: true });
    });

    httpMock.expectOne('/api/test/').flush({ ok: true });
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('should extract detail message from error body', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').flush(
      { detail: 'Invalid credentials' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(snackBar.open).toHaveBeenCalledWith('Invalid credentials', 'Close', jasmine.objectContaining({ duration: 5000 }));
  });

  it('should show "Unable to connect" for status 0', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').error(new ProgressEvent('error'), {
      status: 0, statusText: 'Unknown',
    });

    expect(snackBar.open).toHaveBeenCalledWith('Unable to connect to the server', 'Close', jasmine.objectContaining({ duration: 5000 }));
  });

  it('should show "Access denied" for status 403', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').flush(
      {},
      { status: 403, statusText: 'Forbidden' },
    );

    expect(snackBar.open).toHaveBeenCalledWith('Access denied', 'Close', jasmine.objectContaining({ duration: 5000 }));
  });

  it('should show "Resource not found" for status 404', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').flush(
      {},
      { status: 404, statusText: 'Not Found' },
    );

    expect(snackBar.open).toHaveBeenCalledWith('Resource not found', 'Close', jasmine.objectContaining({ duration: 5000 }));
  });

  it('should show server error message for status 500', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').flush(
      {},
      { status: 500, statusText: 'Server Error' },
    );

    expect(snackBar.open).toHaveBeenCalledWith('Server error. Please try again later.', 'Close', jasmine.objectContaining({ duration: 5000 }));
  });

  it('should re-throw the error', () => {
    let errorReceived = false;

    httpClient.get('/api/test/').subscribe({
      error: (err) => {
        errorReceived = true;
        expect(err.status).toBe(422);
      },
    });

    httpMock.expectOne('/api/test/').flush(
      {},
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(errorReceived).toBeTrue();
  });

  it('should skip notification for 401 errors', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').flush(
      {},
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('should skip notification for auth endpoints', () => {
    httpClient.get('/api/auth/token/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/auth/token/').flush(
      { detail: 'Bad credentials' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(snackBar.open).not.toHaveBeenCalled();
  });
});
