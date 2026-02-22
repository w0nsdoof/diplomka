import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { TaskFormComponent } from './task-form.component';
import { TaskService } from '../../../../core/services/task.service';
import { ClientService } from '../../../../core/services/client.service';
import { TagService } from '../../../../core/services/tag.service';

describe('TaskFormComponent', () => {
  let component: TaskFormComponent;
  let fixture: ComponentFixture<TaskFormComponent>;
  let taskService: jasmine.SpyObj<TaskService>;
  let clientService: jasmine.SpyObj<ClientService>;
  let tagService: jasmine.SpyObj<TagService>;
  let router: jasmine.SpyObj<Router>;
  let httpTesting: HttpTestingController;

  const mockClients = { count: 1, next: null, previous: null, results: [{ id: 1, name: 'Client A' }] };
  const mockTags = { count: 1, next: null, previous: null, results: [{ id: 1, name: 'Bug', slug: 'bug', color: '#f00' }] };
  const mockEngineers = { count: 1, next: null, previous: null, results: [{ id: 2, first_name: 'John', last_name: 'Doe', email: 'john@example.com' }] };

  function createComponent(routeParams: any = {}) {
    TestBed.configureTestingModule({
      imports: [TaskFormComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TaskService, useValue: taskService },
        { provide: ClientService, useValue: clientService },
        { provide: TagService, useValue: tagService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { params: routeParams } } },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TaskFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Flush the engineers HTTP request fired in ngOnInit
    const req = httpTesting.expectOne((r) => r.url.includes('/users/'));
    req.flush(mockEngineers);
  }

  beforeEach(() => {
    taskService = jasmine.createSpyObj('TaskService', ['get', 'create', 'update', 'assign']);
    clientService = jasmine.createSpyObj('ClientService', ['list']);
    tagService = jasmine.createSpyObj('TagService', ['list']);
    router = jasmine.createSpyObj('Router', ['navigate']);

    clientService.list.and.returnValue(of(mockClients as any));
    tagService.list.and.returnValue(of(mockTags as any));
  });

  afterEach(() => {
    httpTesting.verify();
  });

  describe('create mode', () => {
    beforeEach(() => createComponent({}));

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should not be in edit mode', () => {
      expect(component.isEdit).toBeFalse();
      expect(component.taskId).toBeNull();
    });

    it('should initialize form with defaults', () => {
      expect(component.taskForm.get('title')?.value).toBe('');
      expect(component.taskForm.get('priority')?.value).toBe('medium');
      expect(component.taskForm.get('tag_ids')?.value).toEqual([]);
      expect(component.taskForm.get('assignee_ids')?.value).toEqual([]);
    });

    it('should require title', () => {
      expect(component.taskForm.get('title')?.hasError('required')).toBeTrue();
    });

    it('should require description', () => {
      expect(component.taskForm.get('description')?.hasError('required')).toBeTrue();
    });

    it('should require deadline', () => {
      expect(component.taskForm.get('deadline')?.hasError('required')).toBeTrue();
    });

    it('should load clients on init', () => {
      expect(clientService.list).toHaveBeenCalled();
      expect(component.clients.length).toBe(1);
    });

    it('should load tags on init', () => {
      expect(tagService.list).toHaveBeenCalled();
      expect(component.tags.length).toBe(1);
    });

    it('should load engineers on init', () => {
      expect(component.engineers.length).toBe(1);
      expect(component.engineers[0].first_name).toBe('John');
    });

    it('should not submit when form is invalid', () => {
      component.onSubmit();
      expect(taskService.create).not.toHaveBeenCalled();
    });

    it('should call create and navigate on valid submit', () => {
      taskService.create.and.returnValue(of({} as any));

      component.taskForm.patchValue({
        title: 'New Task',
        description: 'Description',
        priority: 'high',
        deadline: new Date('2025-06-01'),
      });

      component.onSubmit();

      expect(taskService.create).toHaveBeenCalled();
      expect(component.saving).toBeTrue();
    });
  });

  describe('edit mode', () => {
    const mockTask = {
      id: 5, title: 'Existing', description: 'Desc', status: 'created',
      priority: 'high', deadline: '2025-06-01', client: { id: 1, name: 'C' },
      tags: [{ id: 1, name: 'Bug', slug: 'bug' }], assignees: [{ id: 2, first_name: 'John', last_name: 'Doe' }],
      created_at: '', updated_at: '', comments_count: 0, attachments_count: 0,
      created_by: { id: 1, first_name: 'A', last_name: 'B' },
      comments: [], attachments: [], history: [], version: 1,
    };

    beforeEach(() => {
      taskService.get.and.returnValue(of(mockTask as any));
      createComponent({ id: '5' });
    });

    it('should be in edit mode', () => {
      expect(component.isEdit).toBeTrue();
      expect(component.taskId).toBe(5);
    });

    it('should load task data into form', () => {
      expect(component.taskForm.get('title')?.value).toBe('Existing');
      expect(component.taskForm.get('description')?.value).toBe('Desc');
      expect(component.taskForm.get('priority')?.value).toBe('high');
      expect(component.taskForm.get('client_id')?.value).toBe(1);
      expect(component.taskForm.get('tag_ids')?.value).toEqual([1]);
      expect(component.taskForm.get('assignee_ids')?.value).toEqual([2]);
    });

    it('should call update and assign on submit', () => {
      taskService.update.and.returnValue(of({} as any));
      taskService.assign.and.returnValue(of({} as any));

      component.onSubmit();

      expect(taskService.update).toHaveBeenCalled();
      expect(taskService.assign).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    beforeEach(() => createComponent({}));

    it('should navigate to /tasks', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/tasks']);
    });
  });
});
