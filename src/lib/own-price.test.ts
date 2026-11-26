import { describe, expect, it } from 'vitest';
import { ownImagePrice, registerShop, unitPrice } from './catalog';

describe('your own image price', () => {
  const shop = (ownRate?: number) => ({ defaultRate: 4.5, ownRate, designs: [], designers: [], hidden: [], materialSettings: [] }) as any;
  it('uses the owner\'s own-image price plus the paper add-on', () => {
    registerShop(shop(6));
    expect(ownImagePrice({ factor: 1, priceAdj: 0.5 })).toBe(6.5);
    expect(ownImagePrice({ factor: 1, priceAdj: 1 })).toBe(7);
    expect(unitPrice(undefined, { factor: 1, priceAdj: 0.5 })).toBe(5); // designs keep the standard price
  });
  it('falls back to the standard price when no own-image price is set', () => {
    registerShop(shop(undefined));
    expect(ownImagePrice({ factor: 1, priceAdj: 0.5 })).toBe(5);
  });
});
