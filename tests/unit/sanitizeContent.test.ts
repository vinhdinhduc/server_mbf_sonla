import { sanitizeContent } from '../../src/utils/sanitizeContent';

describe('AC-05.5: HTML from rich text and FAQ', () => {
  it('keeps editor formatting and removes executable content', () => {
    const cleaned = sanitizeContent('<h2>Title</h2><script>alert(1)</script><img src="javascript:alert(2)" onerror="alert(3)"><a href="javascript:alert(4)">open</a><table><tr><td>cell</td></tr></table>');
    expect(cleaned).toContain('<h2>Title</h2>');
    expect(cleaned).toContain('<table>');
    expect(cleaned).not.toMatch(/script|onerror|javascript:/i);
  });
});
