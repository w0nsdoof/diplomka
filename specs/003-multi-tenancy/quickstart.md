# Quickstart: Organization-Based Multi-Tenancy

## Prerequisites

- Python 3.11+, Node 18+, Docker Compose v2
- Clone repo, checkout `003-multi-tenancy` branch
- Copy `.env.example` to `.env` and configure

## Backend Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run migrations (creates Organization model, backfills default org)
python manage.py migrate

# Create superadmin (new role)
python manage.py createsuperadmin --email=admin@platform.com --password=changeme

# Run dev server
python manage.py runserver
```

## Frontend Setup

```bash
cd frontend
npm install
npm start  # dev server at :4200
```

## Testing

```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend
cd frontend && npm run test:ci
```

## Key Files to Modify

### Backend - New App
- `backend/apps/organizations/` - Organization model, admin, migrations

### Backend - Modified Apps
- `backend/apps/accounts/models.py` - Add organization FK, superadmin role
- `backend/apps/accounts/permissions.py` - Add IsSuperadmin, update IsManager
- `backend/apps/clients/models.py` - Add organization FK, scoped uniqueness
- `backend/apps/tasks/models.py` - Add organization FK
- `backend/apps/tags/models.py` - Add organization FK, scoped uniqueness
- `backend/apps/ai_summaries/models.py` - Add organization FK

### Backend - New Module
- `backend/apps/platform/` - Superadmin API (organizations CRUD, manager management)

### Backend - Scoping Mixin
- `backend/apps/organizations/mixins.py` - OrganizationQuerySetMixin for ViewSets

### Backend - Auth Changes
- `backend/config/authentication.py` - Custom JWT auth checking org.is_active

### Backend - Modified ViewSets
- All existing ViewSets gain `OrganizationQuerySetMixin`
- `backend/apps/ai_summaries/tasks.py` - Per-org summary generation

### Frontend - New Routes
- `/platform/organizations` - Superadmin org list
- `/platform/organizations/:id` - Org detail with managers

### Frontend - Modified Files
- `src/app/app.routes.ts` - Add platform routes
- `src/app/core/guards/auth.guard.ts` - Add superadminGuard
- `src/app/core/services/auth.service.ts` - Handle superadmin role, organization_id
- `src/app/core/components/layout/layout.component.ts` - Superadmin nav items
- `src/app/core/components/login/login.component.ts` - Superadmin redirect

## Verification Checklist

1. Existing tests pass unchanged (backward compatibility via default org)
2. Superadmin can create organization and first manager
3. Manager can create users within their org
4. Users in org A cannot see org B's data
5. Deactivating an org blocks its users from logging in
6. Scheduled summaries generate per-organization
7. Kanban WebSocket scoped to organization
