import { describe, expect, test } from 'bun:test';
import { buildSnapshot } from '../../core/canonical-cases.ts';
import { POST_TYPE_GALLERY } from './post-type-gallery.ts';

// cycle-008 S9 (g30) · whole-medium gallery (every post type in Components V2).

const active = () => buildSnapshot({ zone: 'owsley-lab', totalEvents: 352, activeWallets: 15, deltaPct: -13 });

const renderJson = (postType: string): string => JSON.stringify(POST_TYPE_GALLERY.find((i) => i.postType === postType)!.build(active()));

describe('post-type gallery', () => {
  test('every item renders EITHER components (container type 17) OR voice text', () => {
    for (const item of POST_TYPE_GALLERY) {
      const r = item.build(active());
      if (r.components) expect((r.components[0] as { type: number }).type).toBe(17);
      else expect(typeof r.text).toBe('string');
    }
  });

  test('no em/en dashes leak through any layout (core voice rule)', () => {
    for (const item of POST_TYPE_GALLERY) {
      const json = JSON.stringify(item.build(active()));
      expect(json).not.toContain('—');
      expect(json).not.toContain('–');
    }
  });

  test('micro is a voice-text item (not a component)', () => {
    const r = POST_TYPE_GALLERY.find((i) => i.postType === 'micro')!.build(active());
    expect(typeof r.text).toBe('string');
    expect(r.components).toBeUndefined();
    expect(r.text).not.toContain('·'); // ruggy speaks naturally — no middots in voice
  });

  test('weaver reframes to Stonehenge (not "weaving the zones")', () => {
    const json = renderJson('weaver');
    expect(json).toContain('Stonehenge');
    expect(json).not.toContain('weaving the zones');
  });

  test('enriched carries movers + spotlight + a Section (type 9)', () => {
    const json = renderJson('enriched');
    expect(json).toContain('movers');
    expect(json).toContain('spotlight');
    expect(json).toContain('"type":9');
  });
});
