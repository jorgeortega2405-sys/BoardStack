# Project: Enterprise Subscription & Organization Management (BoardPDF)

## Architecture
- **Application**: BoardPDF (`apps/BoardPDF`)
- **Database Authority**: `database/db_identity.sql` and `database/init.sql` (AGENTS.md Rule 11: CERO inline DDL).
- **Backend**: Express + TypeScript in `apps/BoardPDF/src/`
  - PBAC Engine: `PermissionService` (`src/services/permission.service.ts`) resolving active permissions from `subscription_tier_permissions`, `role_permissions`, and `organization_members`.
  - Middlewares: `auth.middleware.ts` (`requirePermission`, `requireFeature`, `hasPermission`, `hasSubscriptionFeature`).
  - Organization API: `organization.routes.ts` mounted at `/api` in `src/index.ts` handled by `organization.controller.ts` and `organization.service.ts`.
  - Security: Strict compliance with AGENTS.md Rule 1 (Zero sensitive error leakage) and Rule 2 (Zero `console.*`, using `Logger`).
- **Frontend**: SPA in `apps/BoardPDF/client/` and partials in `apps/BoardPDF/public/views/`
  - Layout & Navigation: `layout.component.ts` and `sidebar.html` rendering `rail-item-organization` exclusively when active permission `subscription:feature:organization` is present.
  - SPA Routing: `routes.config.ts` mounting `/organization`, `/organization/dashboard`, `/organization/members`, `/organization/sso` with PBAC route guards.
  - Views: `apps/BoardPDF/client/views/organization/` (`organization.view.ts`, `organization-dashboard.view.ts`, `organization-members.view.ts`, `organization-sso.view.ts`).
  - Templates: `apps/BoardPDF/public/views/organization/` (`dashboard.html`, `members.html`, `sso.html`).
  - Directives: AGENTS.md Rule 3 (Zero IDs, only `data-ref`), Rule 4 (button `type` first), Rule 5 (error banners below action buttons), Rule 7 (horizontal imports), Rule 8 (zero comments), Rule 9 (standard lifecycle with `AbortController`), Rule 10 (PBAC only).
- **Automated Test Suite (R5)**:
  - 5 modular suites in `apps/BoardPDF/test/organization/` using Node 20 native `node:test` + `node:assert` + `tsx`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | PBAC & Organization Database Schema | Define tables for permissions, roles, role_permissions, subscription_tier_permissions, organizations, organization_members, organization_invitations, and organization_sso_configs in database/db_identity.sql and database/init.sql | M1 | R2, Explorer 1 |
| F2 | Enterprise Subscription Seed & Tier Mapping | Add SQL seeds assigning enterprise tier permissions (subscription:feature:organization, subscription:feature:sso, org:*, members:*, sso:*) and query for direct database assignment | M1 | R2, Explorer 1 |
| F3 | Backend PermissionService & PBAC Middleware | Implement PermissionService with Redis caching and update auth.middleware.ts with requireFeature, hasPermission, and hasSubscriptionFeature | M1 | R2, Explorer 1 |
| F4 | User Payload & Auth Delivery of Permissions | Update sanitizeUser, UserPayload, and /api/auth/me to deliver active permissions: string[] to the client | M1 | R1, R2, Explorer 1 |
| F5 | Organization Overview & Stats API | Endpoints GET /api/organization and PUT /api/organization with requireFeature('organization') and requirePermission('org:manage') | M1 | R3, Explorer 1 |
| F6 | Organization Member & Invitation Management API | Endpoints for listing members, creating invitations, updating roles, and removing members with granular PBAC guards | M1 | R3, Explorer 1 |
| F7 | SAML 2.0 Configuration & Validation API | Endpoints GET /api/organization/sso and PUT /api/organization/sso with validation for Entity ID, ACS URL, X.509 cert PEM, and XML metadata | M1 | R4, Explorer 1 |
| F8 | Client User Type & State Extension | Update client User interface in client/types/auth.types.ts to include permissions?: string[] and expose hasPermission helper | M2 | R1, Explorer 2 |
| F9 | Navigation Rail Organization Button | Add rail-item-organization to sidebar.html and update layout.component.ts to toggle visibility based on subscription:feature:organization | M2 | R1, Explorer 2 |
| F10 | Organization Drawer & Navigation Routing | Wire organization drawer mode in layout.component.ts and register routes /organization, /organization/dashboard, /organization/members, /organization/sso in routes.config.ts | M2 | R1, R3, R4, Explorer 2 |
| F11 | Organization Dashboard View & Template | Implement OrganizationDashboardController and dashboard.html with summary stats, organization info, and quick actions | M2 | R3, Explorer 2 |
| F12 | Organization Members View & Template | Implement OrganizationMembersController and members.html with members list, invite member modal, role change, and delete actions | M2 | R3, Explorer 2 |
| F13 | Organization SSO/SAML 2.0 View & Template | Implement OrganizationSsoController and sso.html with toggle switch, SAML 2.0 parameters input, validation, and error banner below action buttons | M2 | R4, Explorer 2 |
| F14 | Sales Contact Form Omission & Route Guard | Ensure no sales contact form or active sales route exists anywhere, preserving direct DB assignment workflow | M2 | R2, Explorer 2 |
| F15 | PBAC Access Control Automated Test Suite | Test suite verifying 401 unauthenticated, 403 non-Enterprise, 200 Enterprise, and granular permissions enforcement | M3 | R5, Explorer 3 |
| F16 | Navigation & View Rendering Automated Test Suite | Test suite verifying rail-item-organization visibility and HTML template compliance (Rules 3, 4, 5) | M3 | R5, Explorer 3 |
| F17 | Member Management Automated Test Suite | Test suite verifying member listing, invitations, role modification, remove member, and duplicate guards | M3 | R5, Explorer 3 |
| F18 | SAML 2.0 Configuration Automated Test Suite | Test suite verifying SAML toggle, parameter validation (Entity ID, ACS URL, cert/XML), and persistence | M3 | R5, Explorer 3 |
| F19 | Negative & Security Automated Test Suite | Test suite verifying 404 on sales contact form/routes and zero leakage of sensitive error traces/SQL in HTTP responses | M3 | R5, Explorer 3 |
| F20 | Build, Typecheck & Quality Assurance | Verify npm run typecheck and npm run build pass with 0 errors | M3 | Criteria, Explorer 3 |
| F21 | Adversarial Hardening & Forensic Audit | Run 2 Reviewers, 2 Challengers, and Forensic Auditor verifying zero integrity violations and 100% compliance | M4 | Criteria, AGENTS.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Schema, PBAC Engine & Backend Organization Services | F1, F2, F3, F4, F5, F6, F7 | none | DONE |
| M2 | Frontend Navigation Layout & Organization Views | F8, F9, F10, F11, F12, F13, F14 | M1 | DONE |
| M3 | Automated Test Suite & E2E Verification (R5) | F15, F16, F17, F18, F19, F20 | M1, M2 | DONE |
| M4 | Adversarial Hardening & Final Gate | F21 | M3 | DONE |

## Interface Contracts

### 1. Database DDL Authority (`database/db_identity.sql` & `database/init.sql`)
```sql
CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_permission_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_role_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_tier_permissions (
  tier VARCHAR(50) NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tier, permission_id),
  INDEX idx_sub_tier (tier),
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  owner_id INT NOT NULL,
  logo_url VARCHAR(512) NULL,
  domain VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_owner (owner_id),
  INDEX idx_org_slug (slug),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_org_user (organization_id, user_id),
  INDEX idx_org_members_user (user_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  token VARCHAR(64) NOT NULL UNIQUE,
  invited_by INT NOT NULL,
  status ENUM('pending', 'accepted', 'revoked', 'expired') NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_invitations_token (token),
  INDEX idx_org_invitations_email (email),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_sso_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  entity_id VARCHAR(512) NOT NULL DEFAULT '',
  acs_url VARCHAR(512) NOT NULL DEFAULT '',
  idp_sso_url VARCHAR(512) NULL,
  idp_certificate TEXT NULL,
  idp_metadata_xml MEDIUMTEXT NULL,
  allow_unlinked_users BOOLEAN NOT NULL DEFAULT FALSE,
  enforce_sso BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. Backend Organization REST API Contracts (`/api/organization/*`)
- `GET /api/organization`: Returns `{ organization: { id, uuid, name, slug, owner_id, domain, created_at }, stats: { members_count, active_invitations_count, sso_enabled } }`
- `PUT /api/organization`: Body `{ name?: string, domain?: string }`.
- `GET /api/organization/members`: Returns `{ members: Array<{ id, user_id, email, username, role, status, joined_at }>, invitations: Array<{ id, email, role, status, expires_at, created_at }> }`
- `POST /api/organization/members/invite`: Body `{ email: string, role: 'admin' | 'member' }`.
- `PUT /api/organization/members/:id/role`: Body `{ role: 'admin' | 'member' }`.
- `DELETE /api/organization/members/:id`: Removes member.
- `DELETE /api/organization/invitations/:id`: Revokes invitation.
- `GET /api/organization/sso`: Returns `{ sso: { enabled, entity_id, acs_url, idp_sso_url, has_certificate, has_metadata_xml, enforce_sso } }`
- `PUT /api/organization/sso`: Body `{ enabled: boolean, entity_id?: string, acs_url?: string, idp_sso_url?: string, idp_certificate?: string, idp_metadata_xml?: string, enforce_sso?: boolean }`.

### 3. Navigation Rail Item Contract (`sidebar.html`)
```html
<div class="rail-nav-item rail-nav-item--org is-hidden" data-ref="rail-item-organization">
  <button type="button" class="component-button component-button--h40 component-button--icon-only rail-btn" data-ref="btn-rail-organization" data-tooltip="Organización" data-i18n-tooltip="nav.organization" data-i18n-aria="nav.organization" aria-label="Organización">
    <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#domain"></use></svg>
  </button>
  <span class="rail-nav-item__label" data-ref="rail-label-organization" data-i18n="nav.organization">Organización</span>
</div>
```

## Code Layout
- `database/db_identity.sql`: Canonical DDL authority for all tables and PBAC seeds.
- `database/init.sql`: Docker bootstrap schema file kept strictly in sync with db_identity.sql.
- `apps/BoardPDF/src/services/permission.service.ts`: PBAC permission resolution & cache engine.
- `apps/BoardPDF/src/services/organization.service.ts`: Organization, members, invitations, and SAML business logic.
- `apps/BoardPDF/src/controllers/organization.controller.ts`: REST controller for /api/organization/*.
- `apps/BoardPDF/src/routes/organization.routes.ts`: Organization Express router with PBAC guards.
- `apps/BoardPDF/src/middlewares/auth.middleware.ts`: PBAC middleware functions (requirePermission, requireFeature, hasPermission).
- `apps/BoardPDF/client/types/auth.types.ts`: Extended User interface with permissions?: string[].
- `apps/BoardPDF/client/components/layout.component.ts`: Navigation rail button rendering & drawer integration.
- `apps/BoardPDF/public/views/components/sidebar.html`: Rail HTML partial.
- `apps/BoardPDF/client/config/routes.config.ts`: Organization routes and PBAC client guards.
- `apps/BoardPDF/client/views/organization/*`: TypeScript view controllers for Dashboard, Members, and SSO.
- `apps/BoardPDF/public/views/organization/*`: HTML templates for Dashboard, Members, and SSO.
- `apps/BoardPDF/test/organization/*`: Modular automated test suites for R5.
