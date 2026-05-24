/**
 * Billing API service
 * Typed helpers for subscription and plan operations
 */

export interface Plan {
  id: string;
  name: string;
  description: string;
  priceId: string | null;
  features: string[];
}

export interface Subscription {
  id: string;
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string;
  status: "active" | "past_due" | "canceled" | "incomplete";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch available billing plans
 */
export async function fetchPlans(): Promise<Plan[]> {
  const response = await fetch("/api/billing/plans");
  if (!response.ok) {
    throw new Error("Failed to fetch plans");
  }
  const data = await response.json();
  return data.plans;
}

/**
 * Fetch current organization subscription
 * Requires authentication
 */
export async function fetchSubscription(): Promise<Subscription | null> {
  const response = await fetch("/api/billing/subscription");
  if (!response.ok) {
    throw new Error("Failed to fetch subscription");
  }
  const data = await response.json();
  return data.subscription;
}

/**
 * Initiate Stripe checkout for a plan
 * Returns redirect URL to Stripe Checkout
 */
export async function createCheckoutSession(
  planId: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<string> {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, successUrl, cancelUrl }),
  });

  if (!response.ok) {
    throw new Error("Failed to create checkout session");
  }

  const data = await response.json();
  return data.url;
}

/**
 * Get Stripe Billing Portal URL for subscription management
 */
export async function getBillingPortalUrl(): Promise<string> {
  const response = await fetch("/api/billing/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to get billing portal URL");
  }

  const data = await response.json();
  return data.url;
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Active",
    past_due: "Past Due",
    canceled: "Canceled",
    incomplete: "Incomplete",
  };
  return labels[status] || status;
}

/**
 * Check if subscription is in good standing
 */
export function isSubscriptionActive(subscription: Subscription | null): boolean {
  return subscription?.status === "active";
}
