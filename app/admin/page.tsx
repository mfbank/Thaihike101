'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import { Users, Map, Bus, DollarSign } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    activeTrips: 0,
    totalVans: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const bookingsSnapshot = await getDocs(collection(db, 'bookings'));
        let revenue = 0;
        bookingsSnapshot.forEach(doc => {
          if (doc.data().status === 'Confirmed') {
            revenue += doc.data().totalAmount || 0;
          }
        });
        if (isMounted) {
          setStats(s => ({ ...s, totalBookings: bookingsSnapshot.size, totalRevenue: revenue }));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'bookings');
      }

      try {
        const tripsSnapshot = await getDocs(collection(db, 'trips'));
        let active = 0;
        tripsSnapshot.forEach(doc => {
          if (doc.data().isActive) active++;
        });
        if (isMounted) {
          setStats(s => ({ ...s, activeTrips: active }));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'trips');
      }

      try {
        const vansSnapshot = await getDocs(collection(db, 'vanSchedules'));
        if (isMounted) {
          setStats(s => ({ ...s, totalVans: vansSnapshot.size }));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'vanSchedules');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return <div className="animate-pulse flex space-x-4">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">ภาพรวมแผงควบคุม</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">การจองทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalBookings}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">รายได้รวม</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">฿{stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">ทริปที่เปิดรับ</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.activeTrips}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Map className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">รอบรถตู้</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalVans}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Bus className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Could add charts here using recharts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">ยินดีต้อนรับสู่ระบบจัดการ ThaiHike</h2>
        <p className="text-gray-600">ใช้เมนูด้านข้างเพื่อจัดการการจอง ทริป และรอบรถตู้</p>
      </div>
    </div>
  );
}
