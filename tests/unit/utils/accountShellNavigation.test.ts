import { describe, it, expect } from 'vitest';
import { isAccountShellSectionChange } from '~/app/utils/accountShellNavigation';

describe('isAccountShellSectionChange', () => {
  it.each([
    ['/settings/membership', '/settings/api-keys'],
    ['/settings/preferences', '/settings/security'],
    ['/dashboard/models', '/dashboard/selling'],
  ])('%s -> %s is a section change', (from, to) => {
    expect(isAccountShellSectionChange({ path: to }, { path: from })).toBe(true);
  });

  it.each([
    ['/about', '/settings/preferences'],
    ['/settings/preferences', '/dashboard/models'],
    ['/dashboard/models', '/settings/api-keys'],
    ['/archive/colors', '/archive/wheels'],
    ['/settings/api-keys', '/settings/api-keys'],
  ])('%s -> %s is not', (from, to) => {
    expect(isAccountShellSectionChange({ path: to }, { path: from })).toBe(false);
  });
});
