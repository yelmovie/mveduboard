import { Coupon } from '../types';
import { generateUUID } from '../src/utils/uuid';

const LS_KEY = 'edu_coupons';
const INIT_KEY = 'edu_coupons_initialized';

const initializeCoupons = () => {
    if (!localStorage.getItem(INIT_KEY)) {
        const samples: Coupon[] = [
            { id: generateUUID(), studentName: '김민수', type: '숙제 면제권', issuedDate: new Date().toISOString(), isUsed: false },
            { id: generateUUID(), studentName: '이영희', type: '급식 우선권', issuedDate: new Date(Date.now() - 86400000).toISOString(), isUsed: true },
            { id: generateUUID(), studentName: '박철수', type: '자리 바꾸기권', issuedDate: new Date().toISOString(), isUsed: false },
        ];
        localStorage.setItem(LS_KEY, JSON.stringify(samples));
        localStorage.setItem(INIT_KEY, 'true');
    }
}

export const getCoupons = (): Coupon[] => {
  initializeCoupons();
  const stored = localStorage.getItem(LS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const issueCoupon = (studentName: string, type: string): Coupon => {
  const coupons = getCoupons();
  const newCoupon: Coupon = {
    id: generateUUID(),
    studentName,
    type,
    issuedDate: new Date().toISOString(),
    isUsed: false,
  };
  localStorage.setItem(LS_KEY, JSON.stringify([...coupons, newCoupon]));
  return newCoupon;
};

export const useCoupon = (id: string) => {
  const coupons = getCoupons();
  const updated = coupons.map(c => c.id === id ? { ...c, isUsed: true } : c);
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
};

export const deleteCoupon = (id: string) => {
  const coupons = getCoupons();
  const updated = coupons.filter(c => c.id !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
};