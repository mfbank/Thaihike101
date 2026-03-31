import Image from 'next/image';
import Link from 'next/link';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SerializedTrip } from '@/types';
import { formatTripDateRange } from '@/lib/utils';
import { MapPin, Calendar, Clock, Users, ArrowRight } from 'lucide-react';
import DifficultyFilter from '@/components/DifficultyFilter';

export const dynamic = 'force-dynamic';

async function getTrips() {
  try {
    const q = query(collection(db, 'trips'), where('isActive', '==', true));
    const snapshot = await getDocs(q);
    const tripsData = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toMillis() || null,
        createdAt: data.createdAt?.toMillis() || null,
      };
    }) as SerializedTrip[];
    
    // Sort server-side
    tripsData.sort((a, b) => {
      const dateA = a.date || 0;
      const dateB = b.date || 0;
      return dateA - dateB;
    });
    
    return tripsData;
  } catch (error) {
    console.error("Error fetching trips:", error);
    return [];
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ difficulty?: string }>
}) {
  const trips = await getTrips();
  const resolvedSearchParams = await searchParams;
  const filterDifficulty = resolvedSearchParams.difficulty || 'All';

  const filteredTrips = trips.filter(trip => {
    if (filterDifficulty !== 'All' && trip.difficulty !== filterDifficulty) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] rounded-2xl overflow-hidden mb-16 shadow-xl">
        <Image
          src="/Banner.jpg"
          alt="เดินกากแต่ปากเก่ง Banner"
          fill
          sizes="100vw"
          className="object-cover"
          priority
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">ทริปที่กำลังจะมาถึง</h2>
        <DifficultyFilter defaultValue={filterDifficulty} />
      </div>

      {filteredTrips.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">ไม่มีทริปที่ตรงกับเงื่อนไขของคุณ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrips.map((trip) => {
            const isFullyBooked = trip.bookedSeats >= trip.totalCapacity;
            const availableSeats = trip.totalCapacity - trip.bookedSeats;

            return (
              <div key={trip.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-transform hover:-translate-y-1 hover:shadow-md">
                <div className="relative h-48 w-full bg-gray-200">
                  <Image
                    src={trip.thumbnailUrl || `https://picsum.photos/seed/${trip.id}/800/600`}
                    alt={trip.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-gray-900 shadow-sm">
                    ฿{trip.pricePerPerson.toLocaleString()}
                  </div>
                  <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm ${
                    trip.difficulty === 'Easy' ? 'bg-green-500' :
                    trip.difficulty === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    {trip.difficulty === 'Easy' ? 'ง่าย' : trip.difficulty === 'Medium' ? 'ปานกลาง' : 'ยาก'}
                  </div>
                </div>
                
                <div className="p-6 flex-grow flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{trip.name}</h3>
                  
                  <div className="space-y-2 mb-6 flex-grow">
                    <div className="flex items-center text-gray-600 text-sm">
                      <MapPin className="h-4 w-4 mr-2 text-emerald-600" />
                      {trip.location}
                    </div>
                    <div className="flex items-center text-gray-600 text-sm" suppressHydrationWarning>
                      <Calendar className="h-4 w-4 mr-2 text-emerald-600" />
                      {trip.date ? formatTripDateRange(new Date(trip.date), trip.durationDays) : 'รอประกาศ'}
                    </div>
                    <div className="flex items-center text-gray-600 text-sm">
                      <Clock className="h-4 w-4 mr-2 text-emerald-600" />
                      {trip.durationDays} วัน
                    </div>
                    <div className="flex items-center text-gray-600 text-sm">
                      <Users className="h-4 w-4 mr-2 text-emerald-600" />
                      ว่าง {availableSeats} / {trip.totalCapacity} ที่นั่ง
                    </div>
                  </div>

                  <Link 
                    href={isFullyBooked ? '#' : `/trip/${trip.id}`}
                    className={`w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                      isFullyBooked 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500'
                    }`}
                  >
                    {isFullyBooked ? 'เต็มแล้ว' : 'จองเลย'}
                    {!isFullyBooked && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
