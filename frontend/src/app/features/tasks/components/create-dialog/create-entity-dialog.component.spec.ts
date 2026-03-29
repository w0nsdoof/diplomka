import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CreateEntityDialogComponent } from './create-entity-dialog.component';
import { ProjectService } from '../../../../core/services/project.service';
import { TaskService } from '../../../../core/services/task.service';
import { ClientService } from '../../../../core/services/client.service';
import { TagService } from '../../../../core/services/tag.service';
import { AuthService } from '../../../../core/services/auth.service';

describe('CreateEntityDialogComponent', () => {
  let component: CreateEntityDialogComponent;
  let fixture: ComponentFixture<CreateEntityDialogComponent>;
  let projectServiceSpy: jasmine.SpyObj<ProjectService>;
  let taskServiceSpy: jasmine.SpyObj<TaskService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let clientServiceSpy: jasmine.SpyObj<ClientService>;
  let tagServiceSpy: jasmine.SpyObj<TagService>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<CreateEntityDialogComponent>>;

  const emptyPage = { count: 0, next: null, previous: null, results: [] };

  function createComponent(data: any = null, isManager = true) {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: data });
    authServiceSpy.hasRole.and.callFake((role: string) => {
      if (role === 'manager') return isManager;
      if (role === 'engineer') return !isManager;
      return false;
    });
    authServiceSpy.hasAnyRole.and.returnValue(true);

    fixture = TestBed.createComponent(CreateEntityDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    projectServiceSpy = jasmine.createSpyObj('ProjectService', [
      'listProjects', 'listEpics', 'createProject', 'createEpic', 'getProject',
    ]);
    taskServiceSpy = jasmine.createSpyObj('TaskService', ['list', 'create', 'get']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['hasRole', 'hasAnyRole', 'getCurrentUser']);
    clientServiceSpy = jasmine.createSpyObj('ClientService', ['list']);
    tagServiceSpy = jasmine.createSpyObj('TagService', ['list']);
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

    projectServiceSpy.listProjects.and.returnValue(of(emptyPage));
    projectServiceSpy.listEpics.and.returnValue(of(emptyPage));
    projectServiceSpy.createProject.and.returnValue(of({ id: 1, title: 'New' } as any));
    projectServiceSpy.createEpic.and.returnValue(of({ id: 1, title: 'New' } as any));
    projectServiceSpy.getProject.and.returnValue(of({ id: 1, title: 'Project' } as any));
    taskServiceSpy.list.and.returnValue(of(emptyPage as any));
    taskServiceSpy.create.and.returnValue(of({ id: 1 } as any));
    taskServiceSpy.get.and.returnValue(of({ id: 1, title: 'Task', epic: null } as any));
    clientServiceSpy.list.and.returnValue(of(emptyPage));
    tagServiceSpy.list.and.returnValue(of(emptyPage));
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 1, email: 'mgr@test.com', first_name: 'A', last_name: 'B',
      role: 'manager', organization_id: 1, language: 'en',
    });

    await TestBed.configureTestingModule({
      imports: [CreateEntityDialogComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService(),
        { provide: ProjectService, useValue: projectServiceSpy },
        { provide: TaskService, useValue: taskServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ClientService, useValue: clientServiceSpy },
        { provide: TagService, useValue: tagServiceSpy },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: null },
      ],
    }).compileComponents();
  });

  it('should create with null data', () => {
    createComponent(null);
    expect(component).toBeTruthy();
  });

  it('should default entity type to task', () => {
    createComponent(null);
    expect(component.entityType).toBe('task');
  });

  it('should set isManager=true for manager', () => {
    createComponent(null, true);
    expect(component.isManager).toBeTrue();
  });

  it('should set isManager=false for engineer', () => {
    createComponent(null, false);
    expect(component.isManager).toBeFalse();
  });

  it('should load dropdown data on init', () => {
    createComponent(null);
    expect(projectServiceSpy.listProjects).toHaveBeenCalled();
    expect(projectServiceSpy.listEpics).toHaveBeenCalled();
    expect(clientServiceSpy.list).toHaveBeenCalled();
    expect(tagServiceSpy.list).toHaveBeenCalled();
    expect(taskServiceSpy.list).toHaveBeenCalled();
  });

  it('should apply parent context for project -> epic', () => {
    createComponent({ parentType: 'project', parentId: 42 });
    expect(component.entityType).toBe('epic');
    expect(component.form.get('project_id')!.value).toBe(42);
  });

  it('should apply parent context for epic -> task', () => {
    createComponent({ parentType: 'epic', parentId: 10, projectId: 1 });
    expect(component.entityType).toBe('task');
    expect(component.form.get('epic_id')!.value).toBe(10);
  });

  it('should apply parent context for task -> subtask', () => {
    createComponent({ parentType: 'task', parentId: 99 });
    expect(component.entityType).toBe('subtask');
    expect(component.form.get('parent_task_id')!.value).toBe(99);
  });

  it('should create form with required title', () => {
    createComponent(null);
    expect(component.form.get('title')).toBeTruthy();
    expect(component.form.get('title')!.hasError('required')).toBeTrue();
  });

  it('should change entity type on onEntityTypeChange', () => {
    createComponent(null);
    component.onEntityTypeChange('project');
    expect(component.entityType).toBe('project');
  });
});
