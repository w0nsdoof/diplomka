import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { TaskDetailComponent } from './task-detail.component';
import { TaskService } from '../../../../core/services/task.service';
import { AuthService } from '../../../../core/services/auth.service';

describe('TaskDetailComponent', () => {
  let component: TaskDetailComponent;
  let fixture: ComponentFixture<TaskDetailComponent>;
  let taskServiceSpy: jasmine.SpyObj<TaskService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  const mockTask = {
    id: 1, title: 'Test Task', status: 'created', priority: 'high',
    deadline: '2025-12-31', created_at: '', updated_at: '',
    client: null, assignees: [], tags: [], comments_count: 0, attachments_count: 0,
    description: 'A test task',
    created_by: { id: 1, first_name: 'A', last_name: 'B' },
    comments: [], attachments: [], history: [], version: 1,
  };

  const mockAttachmentsPage = {
    count: 1, next: null, previous: null,
    results: [
      { id: 1, filename: 'doc.pdf', file_size: 2048, uploaded_by: { id: 1, first_name: 'A', last_name: 'B' }, uploaded_at: '2025-01-01' },
    ],
  };

  const mockHistoryPage = {
    count: 1, next: null, previous: null,
    results: [{ action: 'created', field_name: null, old_value: null, new_value: null, changed_by: { first_name: 'A', last_name: 'B' }, timestamp: '2025-01-01' }],
  };

  beforeEach(async () => {
    taskServiceSpy = jasmine.createSpyObj('TaskService', ['get', 'getAttachments', 'getHistory', 'uploadAttachment', 'downloadAttachment', 'deleteAttachment']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['hasRole']);

    taskServiceSpy.get.and.returnValue(of(mockTask));
    taskServiceSpy.getAttachments.and.returnValue(of(mockAttachmentsPage));
    taskServiceSpy.getHistory.and.returnValue(of(mockHistoryPage));
    taskServiceSpy.uploadAttachment.and.returnValue(of({ id: 2, filename: 'new.txt' }));
    taskServiceSpy.downloadAttachment.and.returnValue(of(new Blob(['test'])));
    taskServiceSpy.deleteAttachment.and.returnValue(of(undefined));
    authServiceSpy.hasRole.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [TaskDetailComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: TaskService, useValue: taskServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: '1' } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch task and attachments on init', () => {
    expect(taskServiceSpy.get).toHaveBeenCalledWith(1);
    expect(taskServiceSpy.getAttachments).toHaveBeenCalledWith(1);
    expect(component.attachments.length).toBe(1);
  });

  it('should not fetch history on init', () => {
    expect(taskServiceSpy.getHistory).not.toHaveBeenCalled();
    expect(component.historyLoaded).toBeFalse();
  });

  it('should fetch history on tab change to History tab', () => {
    component.onTabChange({ index: 1 } as any);
    expect(taskServiceSpy.getHistory).toHaveBeenCalledWith(1);
    expect(component.history.length).toBe(1);
    expect(component.historyLoaded).toBeTrue();
  });

  it('should not re-fetch history if already loaded', () => {
    component.onTabChange({ index: 1 } as any);
    taskServiceSpy.getHistory.calls.reset();
    component.onTabChange({ index: 1 } as any);
    expect(taskServiceSpy.getHistory).not.toHaveBeenCalled();
  });

  it('should delete attachment and reload list', () => {
    component.deleteAttachment(1);
    expect(taskServiceSpy.deleteAttachment).toHaveBeenCalledWith(1, 1);
    // getAttachments called once on init, once after delete
    expect(taskServiceSpy.getAttachments).toHaveBeenCalledTimes(2);
  });

  it('should format file sizes correctly', () => {
    expect(component.formatFileSize(500)).toBe('500 B');
    expect(component.formatFileSize(2048)).toBe('2.0 KB');
    expect(component.formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('should return correct history icons', () => {
    expect(component.getHistoryIcon('created')).toBe('add_circle');
    expect(component.getHistoryIcon('updated')).toBe('edit');
    expect(component.getHistoryIcon('status_changed')).toBe('swap_horiz');
    expect(component.getHistoryIcon('unknown')).toBe('history');
  });
});
