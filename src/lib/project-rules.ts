import { z } from 'zod';
export const quoteDetails = z.object({ amount: z.number().min(1).max(100000), deliveryDays: z.number().int().min(1).max(365), description: z.string().trim().min(3).max(500) });
export function quoteSplit(amount: number) { return { commission: Math.round(amount * 10) / 100, designerPayout: Math.round(amount * 90) / 100 }; }
export function originalDpi(width: number, height: number, widthCm: number, heightCm: number) { return Math.min(width / (widthCm / 2.54), height / (heightCm / 2.54)); }
export function mayApproveProof(status: string, proof: string) { return status === 'accepted' && proof === 'delivered'; }