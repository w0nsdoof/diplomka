import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { EpicDetailComponent } from './epic-detail.component';
import { ProjectService } from '../../../../core/services/project.service';
import { ClientService } from '../../../../core/services/client.service';
import { TagService } from '../../../../core/services/tag.service';
import { AuthService } from '../../../../core/services/auth.service';

describe('EpicDetailComponent', () => {
  let component: EpicDetailComponent;
  let fixture: ComponentFixture<EpicDetailComponent>;
  let projectServiceSpy: jasmine.SpyObj<ProjectService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let clientServiceSpy: jasmine.SpyObj<ClientService>;
  let tagServiceSpy: jasmine.SpyObj<TagService>;

  const mockEpic = {
    id: 5, title: 'Test Epic', status: 'in_progress', priority: 'medium',
    deadline: '2025-12-31', project: { id: 1, title: 'Parent Project' },
    assignee: null, client: null, tags: [], tasks_count: 3,
    created_at: '2025-01-01', updated_at: '2025-01-01',
    description: 'An epic description',
    created_by: { id: 1, first_name: 'A', last_name: 'B' },
    version: 1,
  };

  const mockTasksPage = {
    count: 1, next: null, previous: null,
    results: [{
      id: 20, title: 'Task in epic', status: 'created', priority: 'high',
      deadline: '2025-06-30', assignees: [], subtasks_count: 0,
    }],
  };

  const mockHistoryPage = {
    count: 1, next: null, previous: null,
    results: [{
      action: 'created', field_name: null, old_value: null, new_value: null,
      changed_by: { first_name: 'A', last_name: 'B' }, timestamp: '2025-01-01',
    }],
  };

  beforeEach(async () => {
    projectServiceSpy = jasmine.createSpyObj('ProjectService', [
      'getEpic', 'getEpicTasks', 'getEpicHistory',
      'updateEpic', 'changeEpicStatus', 'listProjects',
    ]);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['hasRole', 'hasAnyRole', 'getCurrentUser']);
    clientServiceSpy = jasmine.createSpyObj('ClientService', ['list']);
    tagServiceSpy = jasmine.createSpyObj('TagService', ['list']);

    projectServiceSpy.getEpic.and.returnValue(of(mockEpic));
    projectServiceSpy.getEpicTasks.and.returnValue(of(mockTasksPage));
    projectServiceSpy.getEpicHistory.and.returnValue(of(mockHistoryPage));
    projectServiceSpy.updateEpic.and.returnValue(of(mockEpic));
    projectServiceSpy.changeEpicStatus.and.returnValue(of({}));
    projectServiceSpy.listProjects.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));
    authServiceSpy.hasRole.and.returnValue(true);
    authServiceSpy.hasAnyRole.and.returnValue(true);
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 1, email: 'mgr@test.com', first_name: 'A', last_name: 'B',
      role: 'manager', organization_id: 1, language: 'en',
    });
    clientServiceSpy.list.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));
    tagServiceSpy.list.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));

    await TestBed.configureTestingModule({
      imports: [EpicDetailComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService(),
        { provide: ProjectService, useValue: projectServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ClientService, useValue: clientServiceSpy },
        { provide: TagService, useValue: tagServiceSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: '5' } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EpicDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load epic on init', () => {
    expect(projectServiceSpy.getEpic).toHaveBeenCalledWith(5);
    expect(component.epic).toBeTruthy();
    expect(component.epic!.title).toBe('Test Epic');
  });

  it('should load tasks on init', () => {
    expect(projectServiceSpy.getEpicTasks).toHaveBeenCalledWith(5);
    expect(component.tasks.length).toBe(1);
  });

  it('should build breadcrumb with parent project', () => {
    expect(component.breadcrumbItems.length).toBe(1);
    expect(component.breadcrumbItems[0].label).toBe('Parent Project');
    expect(component.breadcrumbItems[0].route).toEqual(['/projects', '1']);
  });

  it('should not load history on init', () => {
    expect(projectServiceSpy.getEpicHistory).not.toHaveBeenCalled();
    expect(component.historyLoaded).toBeFalse();
  });

  it('should load history on tab change to History tab', () => {
    component.onTabChange({ index: 1 } as any);
    expect(projectServiceSpy.getEpicHistory).toHaveBeenCalledWith(5);
    expect(component.history.length).toBe(1);
    expect(component.historyLoaded).toBeTrue();
  });

  it('should not re-fetch history if already loaded', () => {
    component.onTabChange({ index: 1 } as any);
    projectServiceSpy.getEpicHistory.calls.reset();
    component.onTabChange({ index: 1 } as any);
    expect(projectServiceSpy.getEpicHistory).not.toHaveBeenCalled();
  });

  it('should set canEdit=true for manager', () => {
    expect(component.canEdit).toBeTrue();
  });

  it('should return correct history icons', () => {
    expect(component.getHistoryIcon('created')).toBe('add_circle');
    expect(component.getHistoryIcon('updated')).toBe('edit');
    expect(component.getHistoryIcon('status_changed')).toBe('swap_horiz');
    expect(component.getHistoryIcon('assigned')).toBe('person_add');
    expect(component.getHistoryIcon('unknown')).toBe('history');
  });

  it('should return available statuses excluding current', () => {
    const statuses = component.getAvailableStatuses('in_progress');
    expect(statuses).not.toContain('in_progress');
    expect(statuses).toContain('created');
    expect(statuses).toContain('done');
  });
});
