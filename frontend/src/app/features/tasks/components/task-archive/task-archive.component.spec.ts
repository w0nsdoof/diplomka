import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TaskArchiveComponent } from './task-archive.component';
import { TaskService, PaginatedResponse, TaskListItem } from '../../../../core/services/task.service';

describe('TaskArchiveComponent', () => {
  let component: TaskArchiveComponent;
  let fixture: ComponentFixture<TaskArchiveComponent>;
  let taskService: jasmine.SpyObj<TaskService>;

  const mockTask: TaskListItem = {
    id: 1, title: 'Archived Task', status: 'archived', priority: 'medium',
    deadline: '2025-12-31', created_at: '', updated_at: '',
    client: null, assignees: [], tags: [],
    comments_count: 0, attachments_count: 0,
  };

  const mockResponse: PaginatedResponse<TaskListItem> = {
    count: 1, next: null, previous: null, results: [mockTask],
  };

  beforeEach(async () => {
    taskService = jasmine.createSpyObj('TaskService', ['list']);
    taskService.list.and.returnValue(of(mockResponse));

    await TestBed.configureTestingModule({
      imports: [TaskArchiveComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService(),
        { provide: TaskService, useValue: taskService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskArchiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load archived tasks on init', () => {
    expect(taskService.list).toHaveBeenCalledWith({
      page: 1, page_size: 20, status: 'archived',
    });
    expect(component.tasks.length).toBe(1);
    expect(component.totalCount).toBe(1);
  });

  it('should have correct columns without status', () => {
    expect(component.displayedColumns).toEqual([
      'title', 'priority', 'assignees', 'client', 'tags', 'deadline',
    ]);
  });

  it('should handle search', () => {
    taskService.list.calls.reset();
    component.onSearch('test');
    expect(taskService.list).toHaveBeenCalledWith({
      page: 1, page_size: 20, status: 'archived', search: 'test',
    });
  });

  it('should handle pagination', () => {
    taskService.list.calls.reset();
    component.onPageChange({ pageIndex: 1, pageSize: 10, length: 20 });
    expect(component.currentPage).toBe(2);
    expect(taskService.list).toHaveBeenCalledWith({
      page: 2, page_size: 10, status: 'archived',
    });
  });
});
