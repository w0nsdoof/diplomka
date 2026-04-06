import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ProjectService } from './project.service';
import { environment } from '../../../environments/environment';

describe('ProjectService', () => {
  let service: ProjectService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateEpicTasks', () => {
    it('should POST to generate-tasks endpoint', () => {
      service.generateEpicTasks(5).subscribe((res) => {
        expect(res.task_id).toBe('abc-123');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/epics/5/generate-tasks/`);
      expect(req.request.method).toBe('POST');
      req.flush({ task_id: 'abc-123' });
    });
  });

  describe('pollGenerationStatus', () => {
    it('should GET status with task_id param', () => {
      service.pollGenerationStatus(5, 'abc-123').subscribe((res) => {
        expect(res.status).toBe('completed');
      });

      const req = httpMock.expectOne(
        `${environment.apiUrl}/epics/5/generate-tasks/status/?task_id=abc-123`
      );
      expect(req.request.method).toBe('GET');
      req.flush({ status: 'completed', result: { tasks: [] }, error: null });
    });
  });

  describe('confirmEpicTasks', () => {
    it('should POST tasks to confirm endpoint', () => {
      const tasks = [
        { title: 'Task 1', description: '', priority: 'high', assignee_id: null, tag_ids: [], estimated_hours: null },
      ];
      service.confirmEpicTasks(5, tasks).subscribe((res) => {
        expect(res.created_count).toBe(1);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/epics/5/confirm-tasks/`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.tasks).toEqual(tasks);
      req.flush({ created_count: 1, tasks: [{ id: 10, title: 'Task 1', status: 'created' }] });
    });
  });
});
