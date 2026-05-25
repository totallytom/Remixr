const monthly = import.meta.env.VITE_PRICE_MONTHLY ?? '$4.99';
const yearlyPerMonth = import.meta.env.VITE_PRICE_YEARLY_PER_MONTH ?? '$3.99';
const yearlyTotal = import.meta.env.VITE_PRICE_YEARLY_TOTAL ?? '$47.99';

export const PRICING = {
  monthly: {
    display: monthly,
    period: '/month',
    checkoutLabel: `${monthly}/mo`,
  },
  yearly: {
    display: yearlyPerMonth,
    period: '/month',
    total: yearlyTotal,
    totalLabel: `billed annually`,
    checkoutLabel: `${yearlyTotal}/yr`,
  },
} as const;
