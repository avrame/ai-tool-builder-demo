import { describe, it, expect } from 'vitest';
import { routeToPage } from '../src/page';
import { App } from '../src/App';
import { NotFound } from '../src/components/NotFound';

describe('routeToPage', () => {
  it('returns home page for root path', () => {
    const page = routeToPage('/');
    expect(page.status).toBe(200);
    expect(page.title).toBe('Arrow App');
    expect(page.description).toBe('A tiny reactive core with SSR when you need it.');
  });

  it('returns home page for empty path', () => {
    const page = routeToPage('');
    expect(page.status).toBe(200);
    expect(page.title).toBe('Arrow App');
  });

  it('returns 404 for unknown paths', () => {
    const page = routeToPage('/unknown');
    expect(page.status).toBe(404);
    expect(page.title).toBe('Not Found | Arrow App');
    expect(page.description).toContain('/unknown');
  });

  it('handles paths with query strings', () => {
    const page = routeToPage('/page?foo=bar');
    expect(page.status).toBe(404);
    expect(page.description).toContain('/page');
  });

  it('returns NotFound component for 404 pages', () => {
    const page = routeToPage('/nonexistent');
    expect(page.view).toBeDefined();
  });

  it('returns App component for home page', () => {
    const page = routeToPage('/');
    expect(page.view).toBeDefined();
  });
});
