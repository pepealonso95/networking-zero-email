import { useAutumn, useCustomer } from 'autumn-js/react';
import { useMemo } from 'react';

type FeatureState = {
  total: number;
  remaining: number;
  unlimited: boolean;
  enabled: boolean;
  usage: number;
  nextResetAt: number | null;
  interval: string;
  included_usage: number;
};

type Features = {
  chatMessages: FeatureState;
  connections: FeatureState;
  brainActivity: FeatureState;
};

const DEFAULT_FEATURES: Features = {
  chatMessages: {
    total: 0,
    remaining: 0,
    unlimited: false,
    enabled: false,
    usage: 0,
    nextResetAt: null,
    interval: '',
    included_usage: 0,
  },
  connections: {
    total: 0,
    remaining: 0,
    unlimited: false,
    enabled: false,
    usage: 0,
    nextResetAt: null,
    interval: '',
    included_usage: 0,
  },
  brainActivity: {
    total: 0,
    remaining: 0,
    unlimited: false,
    enabled: false,
    usage: 0,
    nextResetAt: null,
    interval: '',
    included_usage: 0,
  },
};

const FEATURE_IDS = {
  CHAT: 'chat-messages',
  CONNECTIONS: 'connections',
  BRAIN: 'brain-activity',
} as const;

const PRO_PLANS = ['pro-example', 'pro_annual', 'team', 'enterprise'] as const;

export const useBilling = () => {
  const { customer, refetch, isLoading } = useCustomer();
  const { attach, track, openBillingPortal } = useAutumn();

  const isPro = useMemo(() => {
    // Development override - remove this in production
    if (process.env.NODE_ENV === 'development' && customer?.email === 'rafaeljosealonsogerla@gmail.com') {
      return true;
    }
    
    if (!customer?.products || !Array.isArray(customer.products)) return false;
    return customer.products.some((product) =>
      PRO_PLANS.some((plan) => product.id?.includes(plan) || product.name?.includes(plan)),
    );
  }, [customer]);

  const customerFeatures = useMemo(() => {
    // Development override - if user is considered pro in dev, give them unlimited features
    const isDevelopmentPro = process.env.NODE_ENV === 'development' && 
      customer?.email === 'rafaeljosealonsogerla@gmail.com';

    if (!customer?.features && !isDevelopmentPro) return DEFAULT_FEATURES;

    const features = { ...DEFAULT_FEATURES };

    if (customer.features?.[FEATURE_IDS.CHAT] || isDevelopmentPro) {
      const feature = customer.features?.[FEATURE_IDS.CHAT];
      features.chatMessages = {
        total: feature?.included_usage || 1000,
        remaining: feature?.balance || 1000,
        unlimited: isDevelopmentPro ? true : (feature?.unlimited ?? true),
        enabled: true,
        usage: feature?.usage || 0,
        nextResetAt: feature?.next_reset_at ?? null,
        interval: feature?.interval || '',
        included_usage: feature?.included_usage || 1000,
      };
    } else {
      features.chatMessages = {
        total: 1000,
        remaining: 1000,
        unlimited: true,
        enabled: true,
        usage: 0,
        nextResetAt: null,
        interval: '',
        included_usage: 1000,
      };
    }

    if (customer.features?.[FEATURE_IDS.CONNECTIONS] || isDevelopmentPro) {
      const feature = customer.features?.[FEATURE_IDS.CONNECTIONS];
      features.connections = {
        total: isDevelopmentPro ? 999 : (feature?.included_usage || 0),
        remaining: isDevelopmentPro ? 999 : (feature?.balance || 0),
        unlimited: isDevelopmentPro ? true : (feature?.unlimited ?? false),
        enabled: isDevelopmentPro ? true : ((feature?.unlimited ?? false) || Number(feature?.balance) > 0),
        usage: feature?.usage || 0,
        nextResetAt: feature?.next_reset_at ?? null,
        interval: feature?.interval || '',
        included_usage: isDevelopmentPro ? 999 : (feature?.included_usage || 0),
      };
    }

    if (customer.features?.[FEATURE_IDS.BRAIN] || isDevelopmentPro) {
      const feature = customer.features?.[FEATURE_IDS.BRAIN];
      features.brainActivity = {
        total: isDevelopmentPro ? 999 : (feature?.included_usage || 0),
        remaining: isDevelopmentPro ? 999 : (feature?.balance || 0),
        unlimited: isDevelopmentPro ? true : (feature?.unlimited ?? false),
        enabled: isDevelopmentPro ? true : ((feature?.unlimited ?? false) || Number(feature?.balance) > 0),
        usage: feature?.usage || 0,
        nextResetAt: feature?.next_reset_at ?? null,
        interval: feature?.interval || '',
        included_usage: isDevelopmentPro ? 999 : (feature?.included_usage || 0),
      };
    }

    return features;
  }, [customer]);

  return {
    isLoading,
    customer,
    refetch,
    attach,
    track,
    openBillingPortal,
    isPro,
    ...customerFeatures,
  };
};
