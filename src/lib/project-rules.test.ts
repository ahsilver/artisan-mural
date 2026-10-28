import { describe, it, expect } from 'vitest';
import { originalDpi, quoteDetails, quoteSplit, mayApproveProof } from './project-rules';
describe('custom project rules', () => {
 it('keeps the studio 10% and designer 90%', () => { expect(quoteSplit(200)).toEqual({ commission:20,designerPayout:180 }); });
 it('requires a whole positive delivery commitment', () => { expect(quoteDetails.safeParse({amount:200,deliveryDays:5,description:'Adapt the mural'}).success).toBe(true); expect(quoteDetails.safeParse({amount:200,deliveryDays:0,description:'Adapt the mural'}).success).toBe(false); });
 it('uses physical dimensions for 250 DPI, not metadata', () => { expect(originalDpi(30000,24000,304.8,243.84)).toBeCloseTo(250); expect(originalDpi(15000,12000,304.8,243.84)).toBeCloseTo(125); });
 it('requires accepted work and a delivered proof before approval', () => { expect(mayApproveProof('accepted','delivered')).toBe(true); expect(mayApproveProof('sent','delivered')).toBe(false); expect(mayApproveProof('accepted','awaiting')).toBe(false); });
});