import { describe, expect, it } from 'vitest';
import {
  blankMarketing,
  cleanMarketing,
  marketingNameMissing,
} from '@/features/platform/components/marketing-section';

describe('sales copy draft', () => {
  it('needs a name in both languages before it can be saved', () => {
    const m = blankMarketing(10);
    expect(marketingNameMissing(m)).toBe(true);
    m.th.displayName = 'Basic';
    expect(marketingNameMissing(m)).toBe(true);
    m.en.displayName = 'Basic';
    expect(marketingNameMissing(m)).toBe(false);
  });

  it('is cleaned before it is sent: trimmed texts, no empty list lines', () => {
    const m = blankMarketing(10);
    m.th = { ...m.th, displayName: ' Basic ', highlights: [' a ', '', '  '], footnotes: [''] };
    const c = cleanMarketing(m);
    expect(c.th.displayName).toBe('Basic');
    expect(c.th.highlights).toEqual(['a']);
    expect(c.th.footnotes).toEqual([]);
  });
});
