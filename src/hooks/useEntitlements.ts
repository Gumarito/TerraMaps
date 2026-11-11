import { useEffect, useState } from 'react';
import { entitlementService, type EntitlementSnapshot } from '@/services/billing/entitlementService';

/** Snapshot reactivo de los derechos del usuario. Arranca la sincronización al primer uso. */
export function useEntitlements(): EntitlementSnapshot {
  const [snapshot, setSnapshot] = useState<EntitlementSnapshot>(() => entitlementService.getSnapshot());

  useEffect(() => {
    entitlementService.start();
    setSnapshot(entitlementService.getSnapshot());
    return entitlementService.subscribe(setSnapshot);
  }, []);

  return snapshot;
}
