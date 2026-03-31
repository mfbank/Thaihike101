import { useState, useEffect } from 'react';
import { collection, query, getDocs, where, Query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import { VanSchedule } from '@/types';

export type { VanSchedule };

export function useVanSchedules(tripId?: string) {
  const [schedules, setSchedules] = useState<VanSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchSchedules() {
      try {
        let q: Query = collection(db, 'vanSchedules');
        if (tripId) {
          q = query(q, where('tripId', '==', tripId));
        }

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as VanSchedule[];
        
        // Sort client-side
        data.sort((a, b) => {
          const timeA = a.departureTime?.toMillis?.() || 0;
          const timeB = b.departureTime?.toMillis?.() || 0;
          return timeA - timeB;
        });
        
        if (isMounted) {
          setSchedules(data);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setLoading(false);
          handleFirestoreError(error, OperationType.GET, 'vanSchedules');
        }
      }
    }

    fetchSchedules();

    return () => {
      isMounted = false;
    };
  }, [tripId]);

  return { schedules, loading };
}
