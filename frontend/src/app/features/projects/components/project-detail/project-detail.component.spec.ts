import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectService } from '../../../../core/services/project.service';
import { ClientService } from '../../../../core/services/client.service';
import { TagService } from '../../../../core/services/tag.service';
import { AuthService } from '../../../../core/services/auth.service';

describe('ProjectDetailComponent', () => {
  let component: ProjectDetailComponent;
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let projectServiceSpy: jasmine.SpyObj<ProjectService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let clientServiceSpy: jasmine.SpyObj<ClientService>;
  let tagServiceSpy: jasmine.SpyObj<TagService>;

  const mockProject = {
    id: 1, title: 'Test Project', status: 'created', priority: 'high',
    deadline: '2025-12-31', assignee: null, client: null, tags: [], team: [],
    epics_count: 2, created_at: '2025-01-01', updated_at: '2025-01-01',
    description: 'A test project',
    created_by: { id: 1, first_name: 'A', last_name: 'B' },
    version: 1,
  };

  const mockEpicsPage = {
    count: 1, next: null, previous: null,
    results: [{
      id: 10, title: 'Epic 1', status: 'created', priority: 'medium',
      deadline: null, project: { id: 1, title: 'Test Project' },
      assignee: null, client: null, tags: [], tasks_count: 3,
      created_at: '2025-01-01', updated_at: '2025-01-01',
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
      'getProject', 'getProjectEpics', 'getProjectHistory',
      'updateProject', 'changeProjectStatus',
    ]);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['hasRole', 'hasAnyRole', 'getCurrentUser']);
    clientServiceSpy = jasmine.createSpyObj('ClientService', ['list']);
    tagServiceSpy = jasmine.createSpyObj('TagService', ['list']);

    projectServiceSpy.getProject.and.returnValue(of(mockProject));
    projectServiceSpy.getProjectEpics.and.returnValue(of(mockEpicsPage));
    projectServiceSpy.getProjectHistory.and.returnValue(of(mockHistoryPage));
    projectServiceSpy.updateProject.and.returnValue(of(mockProject));
    projectServiceSpy.changeProjectStatus.and.returnValue(of({}));
    authServiceSpy.hasRole.and.returnValue(true);
    authServiceSpy.hasAnyRole.and.returnValue(true);
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 1, email: 'mgr@test.com', first_name: 'A', last_name: 'B',
      role: 'manager', organization_id: 1, language: 'en',
    });
    clientServiceSpy.list.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));
    tagServiceSpy.list.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));

    await TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
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
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: '1' } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load project on init', () => {
    expect(projectServiceSpy.getProject).toHaveBeenCalledWith(1);
    expect(component.project).toBeTruthy();
    expect(component.project!.title).toBe('Test Project');
  });

  it('should load epics on init', () => {
    expect(projectServiceSpy.getProjectEpics).toHaveBeenCalledWith(1);
    expect(component.epics.length).toBe(1);
  });

  it('should not load history on init', () => {
    expect(projectServiceSpy.getProjectHistory).not.toHaveBeenCalled();
    expect(component.historyLoaded).toBeFalse();
  });

  it('should load history on tab change to History tab', () => {
    component.onTabChange({ index: 1 } as any);
    expect(projectServiceSpy.getProjectHistory).toHaveBeenCalledWith(1);
    expect(component.history.length).toBe(1);
    expect(component.historyLoaded).toBeTrue();
  });

  it('should not re-fetch history if already loaded', () => {
    component.onTabChange({ index: 1 } as any);
    projectServiceSpy.getProjectHistory.calls.reset();
    component.onTabChange({ index: 1 } as any);
    expect(projectServiceSpy.getProjectHistory).not.toHaveBeenCalled();
  });

  it('should return correct history icons', () => {
    expect(component.getHistoryIcon('created')).toBe('add_circle');
    expect(component.getHistoryIcon('updated')).toBe('edit');
    expect(component.getHistoryIcon('status_changed')).toBe('swap_horiz');
    expect(component.getHistoryIcon('assigned')).toBe('person_add');
    expect(component.getHistoryIcon('unknown')).toBe('history');
  });

  it('should return available statuses excluding current', () => {
    const statuses = component.getAvailableStatuses('created');
    expect(statuses).not.toContain('created');
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('done');
  });
});
