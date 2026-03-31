import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TagService, Tag, PaginatedResponse } from './tag.service';

describe('TagService', () => {
  let service: TagService;
  let httpMock: HttpTestingController;

  const mockTag: Tag = { id: 1, name: 'Bug', color: '#ff0000' };

  const mockPaginated: PaginatedResponse<Tag> = {
    count: 1, next: null, previous: null, results: [mockTag],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TagService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('list', () => {
    it('should GET tags with page_size=100', () => {
      service.list().subscribe((res) => {
        expect(res.results.length).toBe(1);
      });

      const req = httpMock.expectOne((r) => r.url === '/api/tags/');
      expect(req.request.params.get('page_size')).toBe('100');
      expect(req.request.params.has('search')).toBeFalse();
      req.flush(mockPaginated);
    });

    it('should include search param when provided', () => {
      service.list('bug').subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/tags/');
      expect(req.request.params.get('search')).toBe('bug');
      req.flush(mockPaginated);
    });
  });

  describe('create', () => {
    it('should POST a new tag with name only', () => {
      service.create('Feature').subscribe();

      const req = httpMock.expectOne('/api/tags/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Feature' });
      req.flush(mockTag);
    });

    it('should POST a new tag with name and color', () => {
      service.create('Urgent', '#ff0000').subscribe();

      const req = httpMock.expectOne('/api/tags/');
      expect(req.request.body).toEqual({ name: 'Urgent', color: '#ff0000' });
      req.flush(mockTag);
    });
  });

  describe('delete', () => {
    it('should DELETE a tag by id', () => {
      service.delete(1).subscribe();

      const req = httpMock.expectOne('/api/tags/1/');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
