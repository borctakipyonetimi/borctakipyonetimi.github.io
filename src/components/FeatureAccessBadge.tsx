/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  isPassActive,
  isTemporaryPassActive,
  getTemporaryPassDaysRemaining,
  getTemporaryPassDurationLabel,
  RewardedFeatureType
} from "../utils/rewardedAdService";

export function useFeatureAccess(
  featureKey: RewardedFeatureType | string = "any",
  isPremiumProp?: boolean
) {
  const auth = useAuth();
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener("rewarded_pass_updated", refresh);
    window.addEventListener("premium_status_changed", refresh);
    window.addEventListener("auth_state_changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rewarded_pass_updated", refresh);
      window.removeEventListener("premium_status_changed", refresh);
      window.removeEventListener("auth_state_changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const isPaidPremium = Boolean(auth.isPremium);
  const isTrialActive = Boolean(!isPaidPremium && auth.isTrialActive && auth.trialDaysRemaining > 0);
  const trialDaysRemaining = auth.trialDaysRemaining;
  const has24HourPass = Boolean(!isPaidPremium && !isTrialActive && isTemporaryPassActive(featureKey));
  const passDaysRemaining = has24HourPass ? getTemporaryPassDaysRemaining(featureKey) : 0;
  const passDurationLabel = has24HourPass ? getTemporaryPassDurationLabel(featureKey) : null;
  const hasAccess = Boolean(
    isPaidPremium || isTrialActive || has24HourPass || isPassActive(featureKey) || isPremiumProp
  );

  return {
    isPaidPremium,
    isTrialActive,
    trialDaysRemaining,
    has24HourPass,
    passDaysRemaining,
    passDurationLabel,
    hasAccess,
    needsAd: !hasAccess
  };
}

interface FeatureAccessBadgeProps {
  featureKey: RewardedFeatureType | string;
  isPremiumProp?: boolean;
  compact?: boolean;
  hideWhenPaid?: boolean;
  className?: string;
}

export const FeatureAccessBadge: React.FC<FeatureAccessBadgeProps> = ({
  featureKey,
  isPremiumProp,
  compact = false,
  hideWhenPaid = false,
  className = ""
}) => {
  const {
    isPaidPremium,
    isTrialActive,
    trialDaysRemaining,
    has24HourPass,
    passDaysRemaining
  } = useFeatureAccess(featureKey, isPremiumProp);

  if (isPaidPremium) {
    if (hideWhenPaid) return null;
    return (
      <span
        className={`ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black font-mono uppercase tracking-tight bg-amber-400 text-slate-950 shrink-0 ${className}`}
      >
        PRO
      </span>
    );
  }

  if (isTrialActive && trialDaysRemaining > 0) {
    return (
      <span
        className={`ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black font-mono uppercase tracking-tight bg-indigo-600 text-white shrink-0 ${className}`}
      >
        {trialDaysRemaining} GÜN KALDI
      </span>
    );
  }

  if (has24HourPass) {
    return (
      <span
        className={`ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black font-mono uppercase tracking-tight bg-emerald-500 text-white shrink-0 ${className}`}
      >
        {Math.max(1, passDaysRemaining)} GÜN KALDI
      </span>
    );
  }

  return (
    <span
      className={`ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black font-mono uppercase tracking-tight bg-amber-500 text-slate-950 shrink-0 ${className}`}
    >
      {compact ? "REKLAM" : "🎬 REKLAM"}
    </span>
  );
};
