import { describe, expect, it } from 'vitest';
import { defaultColors } from './design-taxonomy';
import { smartSearch, type SearchDoc } from './smart-search';

const docs: (SearchDoc & { id: string })[] = [
  { id: 'kingdom', title: 'Animal Kingdom', kind: 'mural', palette: 'Sage, cream, ochre', rooms: ['Kids & nursery'], styles: ['Animals'], description: 'Jungle friends for a playroom' },
  { id: 'peony', title: 'Peony Garden', kind: 'repeating pattern', palette: 'Dusty rose, cream', rooms: ['Bedroom'], styles: ['Floral'], tags: ['flowers'] },
  { id: 'harbor', title: 'Harbor Blue', kind: 'repeating pattern', palette: 'Navy, white', rooms: ['Bathroom'], styles: ['Coastal'], designer: 'Maren Holt' },
  { id: 'fern', title: 'Fern Study', kind: 'mural', palette: 'Olive, bone', styles: ['Botanical'], sku: 'AM-1042', description: 'Pressed fern leaves' },
];
const find = (q: string) => smartSearch(docs, (d) => d, q, defaultColors);
const ids = (q: string) => find(q).list.map((d) => d.id);

describe('smart shop search', () => {
  it('matches each word on its own, in any order and in any field', () => {
    expect(ids('nursery animal')).toEqual(['kingdom']);
    expect(ids('rose bedroom wallpaper')).toEqual(['peony']);
  });
  it('understands plurals, synonyms and color words', () => {
    expect(ids('ferns')).toContain('fern');
    expect(ids('children')).toEqual(['kingdom']);
    expect(ids('floral')).toContain('peony');
    expect(ids('blue')).toContain('harbor'); // palette says "navy"
  });
  it('forgives small typos and half-typed words', () => {
    expect(ids('botanicl')).toEqual(['fern']);
    expect(ids('peon')).toEqual(['peony']);
    expect(ids('flaoral')).toContain('peony');
  });
  it('finds a design by SKU and by designer', () => {
    expect(ids('am-1042')).toEqual(['fern']);
    expect(ids('maren')).toEqual(['harbor']);
  });
  it('ranks a word in the name above one in the description', () => {
    expect(ids('fern')[0]).toBe('fern');
    expect(ids('cream')).toEqual(expect.arrayContaining(['kingdom', 'peony']));
  });
  it('shows the closest designs when nothing has every word', () => {
    const r = find('navy unicorn');
    expect(r.closest).toBe(true);
    expect(r.list[0]!.id).toBe('harbor');
  });
});
