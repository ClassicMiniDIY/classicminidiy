// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isProtectedMcpPath, normalizeMcpPath, MCP_PUBLIC_PATHS } from '~/server/utils/mcpRoutes';

describe('server/utils/mcpRoutes', () => {
  describe('isProtectedMcpPath', () => {
    it('protects the JSON-RPC endpoint', () => {
      expect(isProtectedMcpPath('/mcp')).toBe(true);
    });

    // The regression this util exists for: Nitro's router folds '/mcp/' onto the
    // '/mcp' handler while getRequestURL still reports the trailing slash, so an
    // exact-match gate let one appended character reach the handler unauthenticated.
    it.each(['/mcp/', '/mcp//', '/mcp///'])('protects the trailing-slash form %s', (path) => {
      expect(isProtectedMcpPath(path)).toBe(true);
    });

    it('protects unrecognised subpaths by default', () => {
      expect(isProtectedMcpPath('/mcp/sse')).toBe(true);
      expect(isProtectedMcpPath('/mcp/some-future-route')).toBe(true);
    });

    it.each([...MCP_PUBLIC_PATHS])('leaves the public route %s open', (path) => {
      expect(isProtectedMcpPath(path)).toBe(false);
    });

    it('leaves the public routes open in their trailing-slash form too', () => {
      expect(isProtectedMcpPath('/mcp/deeplink/')).toBe(false);
      expect(isProtectedMcpPath('/mcp/badge.svg/')).toBe(false);
    });

    it('does not match unrelated paths that merely share the prefix', () => {
      expect(isProtectedMcpPath('/mcp-other')).toBe(false);
      expect(isProtectedMcpPath('/mcpfoo')).toBe(false);
      expect(isProtectedMcpPath('/mcp-other/nested')).toBe(false);
    });

    it('does not match unrelated routes', () => {
      expect(isProtectedMcpPath('/')).toBe(false);
      expect(isProtectedMcpPath('/api/listings')).toBe(false);
    });
  });

  describe('normalizeMcpPath', () => {
    it('strips trailing slashes', () => {
      expect(normalizeMcpPath('/mcp/')).toBe('/mcp');
      expect(normalizeMcpPath('/mcp///')).toBe('/mcp');
    });

    it('leaves root alone', () => {
      expect(normalizeMcpPath('/')).toBe('/');
    });

    it('leaves a path without a trailing slash alone', () => {
      expect(normalizeMcpPath('/mcp')).toBe('/mcp');
    });
  });
});
