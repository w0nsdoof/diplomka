import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ProfileService, UserProfile, UpdateProfilePayload } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;

  const fakeProfile: UserProfile = {
    id: 1,
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'engineer',
    avatar: null,
    job_title: 'Developer',
    skills: 'Python, TypeScript',
    bio: 'A developer',
    date_joined: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getProfile', () => {
    it('should GET /api/users/me/', () => {
      service.getProfile().subscribe((profile) => {
        expect(profile).toEqual(fakeProfile);
      });

      const req = httpMock.expectOne('/api/users/me/');
      expect(req.request.method).toBe('GET');
      req.flush(fakeProfile);
    });
  });

  describe('updateProfile', () => {
    it('should PATCH /api/users/me/ with partial data', () => {
      const payload: UpdateProfilePayload = { first_name: 'Updated', job_title: 'Senior Dev' };

      service.updateProfile(payload).subscribe((profile) => {
        expect(profile.first_name).toBe('Updated');
      });

      const req = httpMock.expectOne('/api/users/me/');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(payload);
      req.flush({ ...fakeProfile, first_name: 'Updated', job_title: 'Senior Dev' });
    });
  });

  describe('uploadAvatar', () => {
    it('should PATCH /api/users/me/ with FormData', () => {
      const file = new File(['img'], 'avatar.png', { type: 'image/png' });

      service.uploadAvatar(file).subscribe((profile) => {
        expect(profile.avatar).toBeTruthy();
      });

      const req = httpMock.expectOne('/api/users/me/');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body instanceof FormData).toBeTrue();
      req.flush({ ...fakeProfile, avatar: '/media/avatars/avatar.png' });
    });
  });

  describe('removeAvatar', () => {
    it('should PATCH /api/users/me/ with avatar null', () => {
      service.removeAvatar().subscribe((profile) => {
        expect(profile.avatar).toBeNull();
      });

      const req = httpMock.expectOne('/api/users/me/');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ avatar: null });
      req.flush({ ...fakeProfile, avatar: null });
    });
  });
});
