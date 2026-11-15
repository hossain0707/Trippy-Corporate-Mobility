const discountKeys = {1:'firstMonth', 3:'threeMonths', 6:'sixMonths', 12:'twelveMonths'};

export function subscriptionDiscount(pricing, months, welcomeEligible = false) {
  return months === 1 && !welcomeEligible ? 0 : pricing.discounts[discountKeys[months]];
}

export function subscriptionQuote(pricing, vehicle, months, welcomeEligible) {
  const monthlyBase = pricing.monthly[vehicle];
  const discount = subscriptionDiscount(pricing, months, welcomeEligible);
  const base = monthlyBase * months;
  const total = Math.floor(base * (100 - discount) / 100);
  return {base, discount, monthly: total / months, total};
}
