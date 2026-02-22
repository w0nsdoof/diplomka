import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TaskService, TaskListItem, TaskDetail, PaginatedResponse } from './task.service';

describe('TaskService', () => {
  let service: TaskService;
  let httpMock: HttpTestingController;

  const mockPaginated: PaginatedResponse<TaskListItem> = {
    count: 1,
    next: null,
    previous: null,
    results: [{
      id: 1, title: 'Test Task', status: 'created', priority: 'high',
      deadline: '2025-12-31', created_at: '', updated_at: '',
      client: null, assignees: [], tags: [], comments_count: 0, attachments_count: 0,
    }],
  };

  const mockDetail: TaskDetail = {
    ...mockPaginated.results[0],
    description: 'A test task',
    created_by: { id: 1, first_name: 'A', last_name: 'B' },
    comments: [], attachments: [], history: [], version: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TaskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('list', () => {
    it('should GET tasks with no filters', () => {
      service.list().subscribe((res) => {
        expect(res.count).toBe(1);
        expect(res.results.length).toBe(1);
      });

      const req = httpMock.expectOne('/api/tasks/');
      expect(req.request.method).toBe('GET');
      req.flush(mockPaginated);
    });

    it('should pass filter params', () => {
      service.list({ status: 'created', page: 2, priority: 'high' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/tasks/');
      expect(req.request.params.get('status')).toBe('created');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('priority')).toBe('high');
      req.flush(mockPaginated);
    });

    it('should skip undefined/null/empty filter values', () => {
      service.list({ status: undefined, priority: '', page: 1 }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/tasks/');
      expect(req.request.params.has('status')).toBeFalse();
      expect(req.request.params.has('priority')).toBeFalse();
      expect(req.request.params.get('page')).toBe('1');
      req.flush(mockPaginated);
    });
  });

  describe('get', () => {
    it('should GET a single task by id', () => {
      service.get(42).subscribe((res) => {
        expect(res.title).toBe('Test Task');
      });

      const req = httpMock.expectOne('/api/tasks/42/');
      expect(req.request.method).toBe('GET');
      req.flush(mockDetail);
    });
  });

  describe('create', () => {
    it('should POST a new task', () => {
      const payload = { title: 'New', description: 'Desc', priority: 'low', deadline: '2025-01-01' };
      service.create(payload).subscribe((res) => {
        expect(res.id).toBe(1);
      });

      const req = httpMock.expectOne('/api/tasks/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(mockDetail);
    });
  });

  describe('update', () => {
    it('should PATCH an existing task', () => {
      service.update(5, { title: 'Updated' }).subscribe();

      const req = httpMock.expectOne('/api/tasks/5/');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ title: 'Updated' });
      req.flush(mockDetail);
    });
  });

  describe('changeStatus', () => {
    it('should POST status change', () => {
      service.changeStatus(3, 'in_progress', 'Starting work').subscribe();

      const req = httpMock.expectOne('/api/tasks/3/status/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ status: 'in_progress', comment: 'Starting work' });
      req.flush({});
    });

    it('should POST status change without comment', () => {
      service.changeStatus(3, 'done').subscribe();

      const req = httpMock.expectOne('/api/tasks/3/status/');
      expect(req.request.body).toEqual({ status: 'done', comment: undefined });
      req.flush({});
    });
  });

  describe('assign', () => {
    it('should POST assignee ids', () => {
      service.assign(7, [1, 2, 3]).subscribe();

      const req = httpMock.expectOne('/api/tasks/7/assign/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ assignee_ids: [1, 2, 3] });
      req.flush({});
    });
  });

  describe('getHistory', () => {
    it('should GET history with page param', () => {
      service.getHistory(10, 2).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/tasks/10/history/');
      expect(req.request.params.get('page')).toBe('2');
      req.flush({ count: 0, next: null, previous: null, results: [] });
    });

    it('should default to page 1', () => {
      service.getHistory(10).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/tasks/10/history/');
      expect(req.request.params.get('page')).toBe('1');
      req.flush({ count: 0, next: null, previous: null, results: [] });
    });
  });

  describe('getAttachments', () => {
    it('should GET attachments for a task', () => {
      service.getAttachments(5).subscribe((res) => {
        expect(res.results.length).toBe(1);
      });

      const req = httpMock.expectOne('/api/tasks/5/attachments/');
      expect(req.request.method).toBe('GET');
      req.flush({ count: 1, next: null, previous: null, results: [{ id: 1, filename: 'doc.pdf', file_size: 1024 }] });
    });
  });

  describe('uploadAttachment', () => {
    it('should POST file as FormData', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      service.uploadAttachment(5, file).subscribe();

      const req = httpMock.expectOne('/api/tasks/5/attachments/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      req.flush({ id: 1, filename: 'test.txt' });
    });
  });

  describe('downloadAttachment', () => {
    it('should GET attachment as blob', () => {
      service.downloadAttachment(5, 10).subscribe((res) => {
        expect(res instanceof Blob).toBeTrue();
      });

      const req = httpMock.expectOne('/api/tasks/5/attachments/10/');
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['data']));
    });
  });

  describe('deleteAttachment', () => {
    it('should DELETE an attachment', () => {
      service.deleteAttachment(5, 10).subscribe();

      const req = httpMock.expectOne('/api/tasks/5/attachments/10/');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
