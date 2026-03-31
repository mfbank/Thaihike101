import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import BookingForm from '@/components/BookingForm';

import { SerializedTrip, SerializedVanSchedule } from '@/types';

export const dynamic = 'force-dynamic';

async function getTrip(id: string): Promise<SerializedTrip | null> {
  const docRef = doc(db, 'trips', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return { 
    id: docSnap.id, 
    ...data,
    date: data.date?.toMillis() || null,
    createdAt: data.createdAt?.toMillis() || null
  } as SerializedTrip;
}

async function getVanSchedules(tripId: string): Promise<SerializedVanSchedule[]> {
  const q = query(collection(db, 'vanSchedules'), where('tripId', '==', tripId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return { 
      id: doc.id, 
      ...data,
      departureTime: data.departureTime?.toMillis() || null,
      createdAt: data.createdAt?.toMillis() || null
    };
  }) as SerializedVanSchedule[];
}

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await getTrip(id);

  if (!trip) {
    notFound();
  }

  const schedules = await getVanSchedules(id);

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      }>
        <BookingForm trip={trip} schedules={schedules} />
      </Suspense>
    </div>
  );
}
