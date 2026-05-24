/**
 * BillingPage: Display plans, current subscription, and manage billing
 */

import React, { useEffect, useState } from "react";
import {
  fetchPlans,
  fetchSubscription,
  createCheckoutSession,
  getBillingPortalUrl,
  getStatusLabel,
  isSubscriptionActive,
  type Plan,
  type Subscription,
} from "../services/billing";

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        const [plansData, subData] = await Promise.all([
          fetchPlans(),
          fetchSubscription(),
        ]);
        setPlans(plansData);
        setSubscription(subData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load billing data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSubscribe = async (planId: string) => {
    try {
      setCheckoutLoading(true);
      const url = await createCheckoutSession(planId);
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create checkout session");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setPortalLoading(true);
      const url = await getBillingPortalUrl();
      // Redirect to Stripe Billing Portal
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to access billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading billing information...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing</h1>
        <p className="text-gray-600 mb-8">Manage your subscription and billing settings</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Current Subscription Status */}
        {subscription && (
          <div className="mb-12 p-6 bg-white border border-gray-200 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Subscription</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-gray-600">Plan</p>
                <p className="font-semibold text-gray-900">
                  {plans.find((p) => p.id === subscription.plan_id)?.name || subscription.plan_id}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p
                  className={`font-semibold ${
                    isSubscriptionActive(subscription)
                      ? "text-green-600"
                      : subscription.status === "past_due"
                        ? "text-yellow-600"
                        : "text-gray-600"
                  }`}
                >
                  {getStatusLabel(subscription.status)}
                </p>
              </div>
              {subscription.current_period_end && (
                <div>
                  <p className="text-sm text-gray-600">Renews</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Since</p>
                <p className="font-semibold text-gray-900">
                  {new Date(subscription.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {portalLoading ? "Loading..." : "Manage Billing"}
            </button>
          </div>
        )}

        {/* Plans Grid */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Available Plans</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-6 rounded-lg border-2 ${
                  subscription?.plan_id === plan.id
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{plan.description}</p>

                {plan.priceId && (
                  <p className="text-gray-500 text-sm mb-4">Stripe price ID: {plan.priceId}</p>
                )}

                <ul className="mb-6 space-y-2">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="text-sm text-gray-700">
                      <span className="mr-2">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {subscription?.plan_id === plan.id ? (
                  <button
                    disabled
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg cursor-default"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={checkoutLoading || !plan.priceId}
                    className={`w-full px-4 py-2 rounded-lg ${
                      plan.priceId
                        ? "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        : "bg-gray-200 text-gray-600 cursor-not-allowed"
                    }`}
                  >
                    {!plan.priceId
                      ? "Not Configured"
                      : checkoutLoading
                        ? "Loading..."
                        : "Subscribe"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
