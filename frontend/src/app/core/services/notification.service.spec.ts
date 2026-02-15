import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NotificationService, Notification, PaginatedResponse } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;

  const mockNotification: Notification = {
    id: 1, type: 'task_assigned', title: 'Assigned', message: 'You were assigned',
    is_read: false, task_id: 10, summary_id: null, created_at: '2025-01-01T00:00:00Z',
  };

  const mockPaginated: PaginatedResponse<Notification> = {
    count: 5, next: null, previous: null, results: [mockNotification],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('list', () => {
    it('should GET notifications with page param', () => {
      service.list(undefined, 2).subscribe((res) => {
        expect(res.count).toBe(5);
      });

      const req = httpMock.expectOne((r) => r.url === '/api/notifications/');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.has('is_read')).toBeFalse();
      req.flush(mockPaginated);
    });

    it('should include is_read param when specified', () => {
      service.list(false).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/notifications/');
      expect(req.request.params.get('is_read')).toBe('false');
      req.flush(mockPaginated);
    });
  });

  describe('markAsRead', () => {
    it('should PATCH notification and decrement unread count', () => {
      // Set initial count
      (service as any).unreadCountSubject.next(3);
      let count = 0;
      service.unreadCount$.subscribe((c) => (count = c));

      service.markAsRead(1).subscribe();

      const req = httpMock.expectOne('/api/notifications/1/read/');
      expect(req.request.method).toBe('PATCH');
      req.flush({});

      expect(count).toBe(2);
    });

    it('should not decrement below zero', () => {
      (service as any).unreadCountSubject.next(0);
      let count = -1;
      service.unreadCount$.subscribe((c) => (count = c));

      service.markAsRead(1).subscribe();
      httpMock.expectOne('/api/notifications/1/read/').flush({});

      expect(count).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('should POST and reset unread count to 0', () => {
      (service as any).unreadCountSubject.next(10);
      let count = -1;
      service.unreadCount$.subscribe((c) => (count = c));

      service.markAllAsRead().subscribe((res) => {
        expect(res.updated_count).toBe(10);
      });

      const req = httpMock.expectOne('/api/notifications/read-all/');
      expect(req.request.method).toBe('POST');
      req.flush({ updated_count: 10 });

      expect(count).toBe(0);
    });
  });

  describe('refreshUnreadCount', () => {
    it('should fetch unread notifications and update count', () => {
      let count = 0;
      service.unreadCount$.subscribe((c) => (count = c));

      service.refreshUnreadCount();

      const req = httpMock.expectOne((r) => r.url === '/api/notifications/');
      expect(req.request.params.get('is_read')).toBe('false');
      req.flush({ count: 7, next: null, previous: null, results: [] });

      expect(count).toBe(7);
    });
  });

  describe('unreadCount$', () => {
    it('should start at 0', () => {
      let count = -1;
      service.unreadCount$.subscribe((c) => (count = c));
      expect(count).toBe(0);
    });
  });
});
