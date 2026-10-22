import { Order, EligibilityResult, CaseType } from './types.ts';
import { getDemoReferenceDate } from './demoData.ts';

/**
 * Calculates days between two ISO date strings (YYYY-MM-DD).
 */
export function calculateDaysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr + 'T00:00:00Z');
  const to = new Date(toDateStr + 'T00:00:00Z');
  const diffTime = to.getTime() - from.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Adds days to an ISO date string and returns YYYY-MM-DD.
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Evaluates an order against ReturnRelay simulated policies based on the application clock.
 */
export function evaluateEligibility(
  order: Order,
  issueDescription: string = '',
  requestedAction: 'return' | 'warranty' | 'auto' = 'auto',
  overrideReferenceDate?: string
): EligibilityResult {
  const refDate = overrideReferenceDate || getDemoReferenceDate();
  const isDelivered = order.orderStatus === 'delivered';
  const daysSinceDelivery = isDelivered ? calculateDaysBetween(order.deliveryDate, refDate) : 0;

  const returnWindowExpires = addDays(order.deliveryDate, order.returnWindowDays);
  const warrantyExpires = addDays(order.deliveryDate, order.warrantyWindowDays);

  const returnDaysRemaining = order.returnWindowDays - daysSinceDelivery;
  const warrantyDaysRemaining = order.warrantyWindowDays - daysSinceDelivery;

  const returnEligible = isDelivered && daysSinceDelivery >= 0 && daysSinceDelivery <= order.returnWindowDays;
  const warrantyEligible = isDelivered && daysSinceDelivery >= 0 && daysSinceDelivery <= order.warrantyWindowDays;

  const options: { type: CaseType; allowed: boolean; reason: string }[] = [];

  // 1. Standard Return (Refund / Replacement)
  if (returnEligible) {
    options.push({
      type: 'return',
      allowed: true,
      reason: `Delivered ${daysSinceDelivery} days ago (within the ${order.returnWindowDays}-day return window). Eligible for full refund or replacement. Window closes on ${returnWindowExpires} (${returnDaysRemaining} days remaining).`,
    });
  } else if (!isDelivered) {
    options.push({
      type: 'return',
      allowed: false,
      reason: `Order has not yet been delivered (current status: ${order.orderStatus}).`,
    });
  } else {
    options.push({
      type: 'return',
      allowed: false,
      reason: `Return window expired on ${returnWindowExpires} (${Math.abs(returnDaysRemaining)} days past the ${order.returnWindowDays}-day window). Standard returns are closed.`,
    });
  }

  // 2. Warranty Replacement
  if (warrantyEligible) {
    options.push({
      type: 'warranty_replacement',
      allowed: true,
      reason: `Delivered ${daysSinceDelivery} days ago (within the ${order.warrantyWindowDays}-day warranty coverage). Eligible for warranty replacement if defective. Valid through ${warrantyExpires} (${warrantyDaysRemaining} days remaining).`,
    });
  } else {
    options.push({
      type: 'warranty_replacement',
      allowed: false,
      reason: `Manufacturer warranty expired on ${warrantyExpires} (${Math.abs(warrantyDaysRemaining)} days past the ${order.warrantyWindowDays}-day coverage).`,
    });
  }

  // 3. Warranty Repair
  if (warrantyEligible) {
    options.push({
      type: 'warranty_repair',
      allowed: true,
      reason: `Defect inspection and authorized warranty repair available under the ${order.warrantyWindowDays}-day manufacturer guarantee (valid until ${warrantyExpires}).`,
    });
  } else {
    options.push({
      type: 'warranty_repair',
      allowed: false,
      reason: `Manufacturer warranty expired on ${warrantyExpires}. Hardware repair services are no longer covered.`,
    });
  }

  // Determine recommendation
  let recommendedAction: CaseType | 'none' = 'none';
  let policySummary = '';
  let detailedExplanation = '';

  if (returnEligible) {
    recommendedAction = requestedAction === 'warranty' ? 'warranty_replacement' : 'return';
    policySummary = `Eligible for standard return (${returnDaysRemaining} days remaining in 30-day window).`;
    detailedExplanation = `Your ${order.productName} was delivered on ${order.deliveryDate} (${daysSinceDelivery} days ago). It qualifies for a standard product return or replacement under the demo 30-day policy (valid through ${returnWindowExpires}).`;
  } else if (warrantyEligible) {
    recommendedAction = 'warranty_replacement';
    policySummary = `Return window closed, but covered under ${order.warrantyWindowDays}-day warranty (${warrantyDaysRemaining} days remaining).`;
    detailedExplanation = `The standard 30-day return window closed on ${returnWindowExpires} (${Math.abs(returnDaysRemaining)} days ago). However, this item is covered under active manufacturer warranty through ${warrantyExpires} (${warrantyDaysRemaining} days remaining). You can request a warranty replacement or authorized repair.`;
  } else {
    recommendedAction = 'none';
    policySummary = `Ineligible for return or warranty (both coverage windows have elapsed).`;
    detailedExplanation = `The 30-day return window closed on ${returnWindowExpires} and the ${order.warrantyWindowDays}-day warranty expired on ${warrantyExpires}. As both demonstration coverage periods have elapsed, automatic returns or warranty resolutions cannot be initiated.`;
  }

  return {
    orderId: order.id,
    referenceDate: refDate,
    daysSinceDelivery,
    isDelivered,
    returnEligible,
    returnWindowExpires,
    returnDaysRemaining,
    warrantyEligible,
    warrantyExpires,
    warrantyDaysRemaining,
    recommendedAction,
    policySummary,
    detailedExplanation,
    options,
  };
}
