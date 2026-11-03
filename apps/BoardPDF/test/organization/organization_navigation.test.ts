import { updateSidebarAuthState } from '../../client/components/layout.component.js';
import { clearUserState, setCurrentUser } from '../../client/services/api.service.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

interface MockClassList {
  add: (c: string) => void;
  classes: Set<string>;
  contains: (c: string) => boolean;
  remove: (c: string) => void;
  toggle: (c: string, force?: boolean) => boolean;
}

function createMockClassList(initialClasses: string[] = []): MockClassList {
  const classes = new Set<string>(initialClasses);
  return {
    add: (c: string) => classes.add(c),
    classes,
    contains: (c: string) => classes.has(c),
    remove: (c: string) => classes.delete(c),
    toggle: (c: string, force?: boolean) => {
      const state = force !== undefined ? force : !classes.has(c);
      if (state) classes.add(c);
      else classes.delete(c);
      return state;
    },
  };
}

function createMockSidebar() {
  const railOrgItem = { classList: createMockClassList(['rail-nav-item', 'rail-nav-item--org', 'is-hidden']) };
  const menuOrgBtn = { classList: createMockClassList(['menu-item', 'is-hidden']) };
  const orgDivider = { classList: createMockClassList(['menu-divider', 'is-hidden']) };

  const elementMap: Record<string, any> = {
    '[data-ref="btn-menu-organization"]': menuOrgBtn,
    '[data-ref="organization-divider"]': orgDivider,
    '[data-ref="rail-item-organization"]': railOrgItem,
  };

  return {
    menuOrgBtn,
    orgDivider,
    querySelector: (selector: string) => elementMap[selector] || null,
    railOrgItem,
  };
}

describe('Feature F16: Navigation Rail & Organization Templates Suite', () => {
  afterEach(() => {
    clearUserState();
  });

  describe('TC-NAV-01: updateSidebarAuthState Visibility Toggles', () => {
    it('sets is-hidden on organization rail button when user is anonymous (null)', () => {
      clearUserState();
      const mockSidebar = createMockSidebar();
      mockSidebar.railOrgItem.classList.remove('is-hidden');

      updateSidebarAuthState(mockSidebar as any);

      assert.strictEqual(mockSidebar.railOrgItem.classList.contains('is-hidden'), true);
      assert.strictEqual(mockSidebar.menuOrgBtn.classList.contains('is-hidden'), true);
      assert.strictEqual(mockSidebar.orgDivider.classList.contains('is-hidden'), true);
    });

    it('sets is-hidden when authenticated user has free, pro, or business tier lacking organization permission', () => {
      const mockSidebar = createMockSidebar();
      mockSidebar.railOrgItem.classList.remove('is-hidden');

      setCurrentUser({
        avatar_url: null,
        email: 'free@example.com',
        id: 10,
        permissions: ['dashboard:view'],
        role: 'USER',
        subscription_status: 'active',
        subscription_tier: 'free',
        two_factor_enabled: false,
        username: 'Free User',
      });
      updateSidebarAuthState(mockSidebar as any);
      assert.strictEqual(mockSidebar.railOrgItem.classList.contains('is-hidden'), true);

      setCurrentUser({
        avatar_url: null,
        email: 'pro@example.com',
        id: 11,
        permissions: ['subscription:feature:pro'],
        role: 'USER',
        subscription_status: 'active',
        subscription_tier: 'pro',
        two_factor_enabled: false,
        username: 'Pro User',
      });
      updateSidebarAuthState(mockSidebar as any);
      assert.strictEqual(mockSidebar.railOrgItem.classList.contains('is-hidden'), true);

      setCurrentUser({
        avatar_url: null,
        email: 'business@example.com',
        id: 12,
        permissions: ['subscription:feature:business'],
        role: 'USER',
        subscription_status: 'active',
        subscription_tier: 'business',
        two_factor_enabled: false,
        username: 'Business User',
      });
      updateSidebarAuthState(mockSidebar as any);
      assert.strictEqual(mockSidebar.railOrgItem.classList.contains('is-hidden'), true);
    });

    it('removes is-hidden (making rail button visible) when user has active subscription:feature:organization', () => {
      const mockSidebar = createMockSidebar();
      assert.strictEqual(mockSidebar.railOrgItem.classList.contains('is-hidden'), true);

      setCurrentUser({
        avatar_url: null,
        email: 'enterprise@example.com',
        id: 1,
        permissions: ['subscription:feature:organization', 'org:view'],
        role: 'USER',
        subscription_status: 'active',
        subscription_tier: 'enterprise',
        two_factor_enabled: false,
        username: 'Enterprise User',
      });

      updateSidebarAuthState(mockSidebar as any);

      assert.strictEqual(mockSidebar.railOrgItem.classList.contains('is-hidden'), false);
      assert.strictEqual(mockSidebar.menuOrgBtn.classList.contains('is-hidden'), false);
      assert.strictEqual(mockSidebar.orgDivider.classList.contains('is-hidden'), false);
    });
  });

  describe('TC-NAV-02: Rule 3 (Zero IDs) Compliance in Organization Templates', () => {
    const orgViewsDir = path.resolve(process.cwd(), 'public/views/organization');
    const templateFiles = ['dashboard.html', 'members.html', 'sso.html'];

    for (const filename of templateFiles) {
      it(`verifies ${filename} contains zero forbidden id attributes`, () => {
        const filePath = path.join(orgViewsDir, filename);
        assert.strictEqual(fs.existsSync(filePath), true, `File ${filename} must exist`);
        const content = fs.readFileSync(filePath, 'utf-8');

        const idMatches = content.match(/\bid\s*=\s*["'][^"']+["']/gi);
        assert.strictEqual(idMatches, null, `Found forbidden id attribute in ${filename}: ${idMatches?.join(', ')}`);
      });
    }

    it('verifies sidebar navigation partial contains zero forbidden id attributes', () => {
      const sidebarPath = path.resolve(process.cwd(), 'public/views/components/sidebar.html');
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      const idMatches = content.match(/\bid\s*=\s*["'][^"']+["']/gi);
      assert.strictEqual(idMatches, null, `Found forbidden id attribute in sidebar.html: ${idMatches?.join(', ')}`);
    });
  });

  describe('TC-NAV-03: Rule 4 (Strict Attribute Order) Compliance in Organization Templates', () => {
    const orgViewsDir = path.resolve(process.cwd(), 'public/views/organization');
    const templateFiles = ['dashboard.html', 'members.html', 'sso.html'];

    for (const filename of templateFiles) {
      it(`verifies ${filename} enforces type first on buttons and class first on other tags`, () => {
        const filePath = path.join(orgViewsDir, filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        const regexButton = /<button\s+([^>]*?)>/gi;
        const regexOtherTag = /<(div|a|label|input|span|section|article|header|footer|nav|aside|main|p|h[1-6]|ul|li|form|select|textarea|table|tr|td|th)\s+([^>]*?)>/gi;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || line.startsWith('<!--')) continue;

          for (const m of line.matchAll(regexButton)) {
            const attrs = m[1].trim();
            assert.ok(
              attrs.startsWith('type='),
              `In ${filename}:${i + 1}, button must have type first: ${m[0]}`
            );
          }

          for (const m of line.matchAll(regexOtherTag)) {
            const attrs = m[2].trim();
            if (attrs.includes('class=')) {
              assert.ok(
                attrs.startsWith('class='),
                `In ${filename}:${i + 1}, tag <${m[1]}> must have class first: ${m[0]}`
              );
            }
          }
        }
      });
    }
  });

  describe('TC-NAV-04: Rule 5 (Error Banners Placed Below Action Buttons) Compliance', () => {
    const orgViewsDir = path.resolve(process.cwd(), 'public/views/organization');

    it('verifies members.html places error banner below action buttons', () => {
      const content = fs.readFileSync(path.join(orgViewsDir, 'members.html'), 'utf-8');
      const actionButtonIndex = content.indexOf('data-ref="btn-submit-invite"');
      const errorBannerIndex = content.indexOf('data-ref="invite-error"');

      assert.ok(actionButtonIndex !== -1, 'btn-submit-invite must exist in members.html');
      assert.ok(errorBannerIndex !== -1, 'invite-error must exist in members.html');
      assert.ok(
        errorBannerIndex > actionButtonIndex,
        'invite-error banner must be placed below action buttons'
      );
    });

    it('verifies sso.html places error banner below action buttons', () => {
      const content = fs.readFileSync(path.join(orgViewsDir, 'sso.html'), 'utf-8');
      const actionButtonIndex = content.indexOf('data-ref="btn-save-sso"');
      const errorBannerIndex = content.indexOf('data-ref="sso-error"');

      assert.ok(actionButtonIndex !== -1, 'btn-save-sso must exist in sso.html');
      assert.ok(errorBannerIndex !== -1, 'sso-error must exist in sso.html');
      assert.ok(
        errorBannerIndex > actionButtonIndex,
        'sso-error banner must be placed below action buttons'
      );
    });

    it('verifies dashboard.html places error banner at bottom below shortcut action buttons', () => {
      const content = fs.readFileSync(path.join(orgViewsDir, 'dashboard.html'), 'utf-8');
      const actionButtonIndex = content.indexOf('data-ref="btn-go-sso"');
      const errorBannerIndex = content.indexOf('data-ref="org-dashboard-error"');

      assert.ok(actionButtonIndex !== -1, 'btn-go-sso must exist in dashboard.html');
      assert.ok(errorBannerIndex !== -1, 'org-dashboard-error must exist in dashboard.html');
      assert.ok(
        errorBannerIndex > actionButtonIndex,
        'org-dashboard-error banner must be placed below action shortcuts'
      );
    });
  });

  describe('TC-NAV-05: Semantic data-ref Structure Across Organization Templates', () => {
    const orgViewsDir = path.resolve(process.cwd(), 'public/views/organization');

    it('dashboard.html contains all required data-ref components', () => {
      const content = fs.readFileSync(path.join(orgViewsDir, 'dashboard.html'), 'utf-8');
      const expectedRefs = [
        'org-dashboard-wrapper',
        'org-title',
        'display-org-name',
        'badge-org-tier',
        'stat-members',
        'stat-invitations',
        'stat-sso',
        'btn-go-members',
        'btn-go-sso',
      ];
      for (const ref of expectedRefs) {
        assert.ok(
          content.includes(`data-ref="${ref}"`),
          `dashboard.html missing data-ref="${ref}"`
        );
      }
    });

    it('members.html contains all required data-ref components', () => {
      const content = fs.readFileSync(path.join(orgViewsDir, 'members.html'), 'utf-8');
      const expectedRefs = [
        'org-members-wrapper',
        'search-members',
        'btn-open-invite',
        'group-invite-form',
        'input-invite-email',
        'select-invite-role',
        'btn-submit-invite',
        'invite-error',
        'invite-success',
        'members-container',
        'invitations-container',
      ];
      for (const ref of expectedRefs) {
        assert.ok(
          content.includes(`data-ref="${ref}"`),
          `members.html missing data-ref="${ref}"`
        );
      }
    });

    it('sso.html contains all required data-ref components', () => {
      const content = fs.readFileSync(path.join(orgViewsDir, 'sso.html'), 'utf-8');
      const expectedRefs = [
        'org-sso-wrapper',
        'item-sso-toggle',
        'checkbox-sso-enable',
        'input-sp-entity-id',
        'input-sp-acs-url',
        'input-idp-entity-id',
        'input-idp-sso-url',
        'input-idp-certificate',
        'input-idp-metadata-xml',
        'checkbox-enforce-sso',
        'btn-save-sso',
        'sso-error',
        'sso-success',
      ];
      for (const ref of expectedRefs) {
        assert.ok(
          content.includes(`data-ref="${ref}"`),
          `sso.html missing data-ref="${ref}"`
        );
      }
    });
  });
});
