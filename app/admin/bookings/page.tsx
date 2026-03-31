'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, runTransaction, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Booking, SerializedBooking, SerializedTrip, SerializedVanSchedule } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import { formatThaiDate } from '@/lib/utils';
import { Eye, XCircle, User, Phone, MessageSquare, Shield, AlertCircle, Heart, PhoneCall, Bus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/Modal';

export type { Booking };

export default function AdminBookings() {
  const [bookings, setBookings] = useState<SerializedBooking[]>([]);
  const [trips, setTrips] = useState<SerializedTrip[]>([]);
  const [vans, setVans] = useState<SerializedVanSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<SerializedBooking | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<SerializedBooking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<SerializedBooking | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'equipment'>('table');

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert' | 'success';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  const fetchData = async (isMounted = true) => {
    try {
      const tripsSnapshot = await getDocs(collection(db, 'trips'));
      if (isMounted) {
        setTrips(tripsSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            date: d.date?.toMillis?.() || null,
            createdAt: d.createdAt?.toMillis?.() || null,
          };
        }) as SerializedTrip[]);
      }
    } catch (error) {
      console.error("Error fetching trips:", error);
    }

    try {
      const vansSnapshot = await getDocs(collection(db, 'vanSchedules'));
      if (isMounted) {
        setVans(vansSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            departureTime: d.departureTime?.toMillis?.() || null,
            createdAt: d.createdAt?.toMillis?.() || null,
          };
        }) as SerializedVanSchedule[]);
      }
    } catch (error) {
      console.error("Error fetching vanSchedules:", error);
    }

    try {
      const bookingsSnapshot = await getDocs(collection(db, 'bookings'));
      if (isMounted) {
        const data = bookingsSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            createdAt: d.createdAt?.toMillis?.() || null,
          };
        }) as SerializedBooking[];
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setBookings(data);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'bookings');
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchData(isMounted);
    return () => { isMounted = false; };
  }, []);

  const confirmCancelBooking = async () => {
    if (!bookingToCancel) return;
    setIsCancelling(true);
    try {
      await runTransaction(db, async (transaction) => {
        const bookingRef = doc(db, 'bookings', bookingToCancel.id);
        const tripRef = doc(db, 'trips', bookingToCancel.tripId);
        const vanRef = doc(db, 'vanSchedules', bookingToCancel.vanScheduleId);

        const [bookingDoc, tripDoc, vanDoc] = await Promise.all([
          transaction.get(bookingRef),
          transaction.get(tripRef),
          transaction.get(vanRef)
        ]);

        if (!bookingDoc.exists() || bookingDoc.data().status === 'Cancelled') {
          throw new Error("Booking already cancelled or does not exist.");
        }

        if (tripDoc.exists()) {
          const tripData = tripDoc.data();
          transaction.update(tripRef, { 
            bookedSeats: Math.max(0, (tripData.bookedSeats || 0) - 1),
            bookedTents: Math.max(0, (tripData.bookedTents || 0) - (bookingDoc.data().tentsCount || 0))
          });
        }
        if (vanDoc.exists()) {
          const currentBookedSeatsList = vanDoc.data().bookedSeatsList || [];
          const newBookedSeatsList = currentBookedSeatsList.filter((seat: string) => seat !== bookingDoc.data().seatNumber);
          const seatNicknames = vanDoc.data().seatNicknames || {};
          const newSeatNicknames = { ...seatNicknames };
          delete newSeatNicknames[bookingDoc.data().seatNumber];

          transaction.update(vanRef, { 
            bookedSeats: Math.max(0, (vanDoc.data().bookedSeats || 0) - 1),
            bookedSeatsList: newBookedSeatsList,
            seatNicknames: newSeatNicknames
          });
        }

        transaction.update(bookingRef, { status: 'Cancelled' });
      });
      setSelectedBooking(null);
      setBookingToCancel(null);
      fetchData();
      setModalConfig({
        isOpen: true,
        title: 'สำเร็จ',
        message: 'ยกเลิกการจองเรียบร้อยแล้ว',
        type: 'success'
      });
    } catch (error) {
      setModalConfig({
        isOpen: true,
        title: 'ข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการยกเลิกการจอง',
        type: 'alert'
      });
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingToCancel.id}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const confirmDeleteBooking = async () => {
    if (!bookingToDelete) return;
    setIsDeleting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const bookingRef = doc(db, 'bookings', bookingToDelete.id);
        const tripRef = doc(db, 'trips', bookingToDelete.tripId);
        const vanRef = doc(db, 'vanSchedules', bookingToDelete.vanScheduleId);

        const [bookingDoc, tripDoc, vanDoc] = await Promise.all([
          transaction.get(bookingRef),
          transaction.get(tripRef),
          transaction.get(vanRef)
        ]);

        if (!bookingDoc.exists()) {
          throw new Error("Booking does not exist.");
        }

        if (bookingDoc.data().status !== 'Cancelled') {
          if (tripDoc.exists()) {
            const tripData = tripDoc.data();
            transaction.update(tripRef, { 
              bookedSeats: Math.max(0, (tripData.bookedSeats || 0) - 1),
              bookedTents: Math.max(0, (tripData.bookedTents || 0) - (bookingDoc.data().tentsCount || 0))
            });
          }
          if (vanDoc.exists()) {
            const currentBookedSeatsList = vanDoc.data().bookedSeatsList || [];
            const newBookedSeatsList = currentBookedSeatsList.filter((seat: string) => seat !== bookingDoc.data().seatNumber);
            const seatNicknames = vanDoc.data().seatNicknames || {};
            const newSeatNicknames = { ...seatNicknames };
            delete newSeatNicknames[bookingDoc.data().seatNumber];

            transaction.update(vanRef, { 
              bookedSeats: Math.max(0, (vanDoc.data().bookedSeats || 0) - 1),
              bookedSeatsList: newBookedSeatsList,
              seatNicknames: newSeatNicknames
            });
          }
        }

        transaction.delete(bookingRef);
      });
      setSelectedBooking(null);
      setBookingToDelete(null);
      fetchData();
      setModalConfig({
        isOpen: true,
        title: 'สำเร็จ',
        message: 'ลบรายการจองเรียบร้อยแล้ว',
        type: 'success'
      });
    } catch (error) {
      setModalConfig({
        isOpen: true,
        title: 'ข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการลบรายการจอง',
        type: 'alert'
      });
      handleFirestoreError(error, OperationType.DELETE, `bookings/${bookingToDelete.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <div>กำลังโหลดการจอง...</div>;

  const totalEquipmentRevenue = bookings.reduce((sum, booking) => {
    if (booking.status === 'Cancelled') return sum;
    // Calculate equipment total if equipment object exists
    if (booking.equipment) {
      const eq = booking.equipment;
      return sum + 
        (eq.tentSet || 0) * 500 + 
        (eq.tent || 0) * 300 + 
        (eq.sleepingBag || 0) * 100 + 
        (eq.sleepingPad || 0) * 70 + 
        (eq.pillow || 0) * 50 + 
        (eq.trekkingPole || 0) * 150;
    }
    // Fallback to tentsCount if equipment object doesn't exist
    const trip = trips.find(t => t.id === booking.tripId);
    return sum + (booking.tentsCount || 0) * (trip?.tentPrice || 0);
  }, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">จัดการการจอง</h1>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${viewMode === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ตารางการจอง
          </button>
          <button 
            onClick={() => setViewMode('equipment')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${viewMode === 'equipment' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            รายการจองอุปกรณ์
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">รหัสการจอง</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ผู้เดินทาง</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ทริป & รถตู้</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bookings.map(booking => {
                const trip = trips.find(t => t.id === booking.tripId);
                const van = vans.find(v => v.id === booking.vanScheduleId);
                return (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">{booking.id.substring(0, 8).toUpperCase()}</div>
                      <div className="text-xs text-gray-500" suppressHydrationWarning>{booking.createdAt ? formatThaiDate(new Date(booking.createdAt), true) : ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{booking.fullName} ({booking.nickname})</div>
                      <div className="text-sm text-gray-500">{booking.phoneNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{trip?.name || 'ไม่ทราบทริป'}</div>
                      <div className="text-sm text-gray-500" suppressHydrationWarning>{van?.departureTime ? formatThaiDate(new Date(van.departureTime), true) : ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        booking.status === 'Confirmed' ? 'bg-green-100 text-green-800' : 
                        booking.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.status === 'Confirmed' ? 'ยืนยันแล้ว' : booking.status === 'Cancelled' ? 'ยกเลิกแล้ว' : booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => setSelectedBooking(booking)} className="text-indigo-600 hover:text-indigo-900 mr-4" title="ดูรายละเอียด"><Eye className="h-4 w-4" /></button>
                      {booking.status !== 'Cancelled' && (
                        <button onClick={() => setBookingToCancel(booking)} className="text-yellow-600 hover:text-yellow-900 mr-4" title="ยกเลิกการจอง"><XCircle className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => setBookingToDelete(booking)} className="text-red-600 hover:text-red-900" title="ลบการจอง"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <span className="text-2xl mr-2">⛺</span>
              <h2 className="text-xl font-bold text-gray-900">รายการเช่าอุปกรณ์ทั้งหมด</h2>
            </div>
            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">
              {bookings.filter(b => b.status !== 'Cancelled' && (b.equipment || b.tentsCount > 0)).length} รายการ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {bookings.filter(b => b.status !== 'Cancelled').map(booking => {
              const eq = booking.equipment || {};
              const hasEquipment = (eq.tentSet || 0) > 0 || (eq.tent || 0) > 0 || (eq.sleepingBag || 0) > 0 || (eq.sleepingPad || 0) > 0 || (eq.pillow || 0) > 0 || (eq.trekkingPole || 0) > 0 || booking.tentsCount > 0;
              
              if (!hasEquipment) return null;

              let equipmentTotal = 0;
              if (booking.equipment) {
                equipmentTotal = 
                  (eq.tentSet || 0) * 500 + 
                  (eq.tent || 0) * 300 + 
                  (eq.sleepingBag || 0) * 100 + 
                  (eq.sleepingPad || 0) * 70 + 
                  (eq.pillow || 0) * 50 + 
                  (eq.trekkingPole || 0) * 150;
              } else {
                const trip = trips.find(t => t.id === booking.tripId);
                equipmentTotal = (booking.tentsCount || 0) * (trip?.tentPrice || 0);
              }

              return (
                <div key={booking.id} className="border border-gray-200 rounded-xl p-5 bg-white hover:border-emerald-300 transition-colors shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl mr-3">
                        👤
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{booking.nickname || booking.fullName}</h3>
                        <p className="text-xs text-gray-500" suppressHydrationWarning>{booking.createdAt ? formatThaiDate(new Date(booking.createdAt), true) : ''}</p>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button onClick={() => setSelectedBooking(booking)} className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 hover:text-emerald-600 transition-colors" title="ดูรายละเอียด">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => setBookingToDelete(booking)} className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 hover:text-red-600 transition-colors" title="ลบการจอง">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                      {(eq.tentSet || 0) > 0 && <div className="flex items-center"><span className="mr-2">🏕️</span> เต็นท์ครบชุด <span className="ml-auto font-medium">x{eq.tentSet}</span></div>}
                      {(eq.tent || 0) > 0 && <div className="flex items-center"><span className="mr-2">⛺</span> เต็นท์เปล่า <span className="ml-auto font-medium">x{eq.tent}</span></div>}
                      {(eq.sleepingBag || 0) > 0 && <div className="flex items-center"><span className="mr-2">🛌</span> ถุงนอน <span className="ml-auto font-medium">x{eq.sleepingBag}</span></div>}
                      {(eq.sleepingPad || 0) > 0 && <div className="flex items-center"><span className="mr-2">🧘</span> แผ่นรองนอน <span className="ml-auto font-medium">x{eq.sleepingPad}</span></div>}
                      {(eq.pillow || 0) > 0 && <div className="flex items-center"><span className="mr-2">🛏️</span> หมอน <span className="ml-auto font-medium">x{eq.pillow}</span></div>}
                      {(eq.trekkingPole || 0) > 0 && <div className="flex items-center"><span className="mr-2">🦯</span> ไม้เทรคกิ้ง <span className="ml-auto font-medium">x{eq.trekkingPole}</span></div>}
                      {/* Fallback for old bookings */}
                      {!booking.equipment && booking.tentsCount > 0 && <div className="flex items-center"><span className="mr-2">🏕️</span> เต็นท์ <span className="ml-auto font-medium">x{booking.tentsCount}</span></div>}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <span className="text-sm text-gray-500">ยอดรวมอุปกรณ์</span>
                    <span className="text-lg font-bold text-emerald-600">
                      ฿{equipmentTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-8 bg-gray-900 text-white p-6 rounded-xl flex justify-between items-center shadow-lg">
            <div className="flex items-center font-medium">
              <span className="mr-3 text-2xl">💰</span> 
              <div>
                <div className="text-lg">รายได้รวมจากอุปกรณ์เช่า</div>
                <div className="text-sm text-gray-400 font-normal">เฉพาะรายการที่ยืนยันแล้ว</div>
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-400">฿{totalEquipmentRevenue.toLocaleString()}</div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">รายละเอียดการจอง</h2>
              <button onClick={() => setSelectedBooking(null)} className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">ปิด</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* User Info */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-3 flex items-center">
                  <User className="w-4 h-4 mr-2" /> ข้อมูลผู้เดินทาง
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-900"><span className="text-gray-500">ชื่อ-สกุล:</span> <span className="font-medium">{selectedBooking.fullName}</span></p>
                  <p className="text-gray-900"><span className="text-gray-500">ชื่อเล่น:</span> <span className="font-medium">{selectedBooking.nickname}</span></p>
                  <p className="text-gray-900 flex items-center"><Phone className="w-3 h-3 mr-1 text-gray-400" /> <span className="text-gray-500 mr-1">เบอร์โทร:</span> <span className="font-medium">{selectedBooking.phoneNumber}</span></p>
                  <p className="text-gray-900 flex items-center"><MessageSquare className="w-3 h-3 mr-1 text-gray-400" /> <span className="text-gray-500 mr-1">LINE ID:</span> <span className="font-medium">{selectedBooking.lineId}</span></p>
                </div>
              </div>

              {/* Booking Info */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center">
                  <Shield className="w-4 h-4 mr-2" /> ข้อมูลการจอง
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-900"><span className="text-gray-500">รหัส:</span> <span className="font-mono font-medium">{selectedBooking.id.toUpperCase()}</span></p>
                  <p className="text-gray-900"><span className="text-gray-500">วันที่จอง:</span> <span className="font-medium" suppressHydrationWarning>{selectedBooking.createdAt ? formatThaiDate(new Date(selectedBooking.createdAt), true) : 'N/A'}</span></p>
                  <p className="text-gray-900 flex items-center">
                    <span className="text-gray-500 mr-2">สถานะ:</span> 
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${selectedBooking.status === 'Confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {selectedBooking.status === 'Confirmed' ? 'ยืนยันแล้ว' : selectedBooking.status === 'Cancelled' ? 'ยกเลิกแล้ว' : selectedBooking.status}
                    </span>
                  </p>
                  <p className="text-gray-900"><span className="text-gray-500">ยอดรวม:</span> <span className="font-bold text-emerald-600">฿{selectedBooking.totalAmount?.toLocaleString()}</span></p>
                </div>
              </div>

              {/* Trip & Van Info */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-orange-700 uppercase tracking-wider mb-3 flex items-center">
                  <Bus className="w-4 h-4 mr-2" /> ทริป & รถตู้
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-900 font-medium">{trips.find(t => t.id === selectedBooking.tripId)?.name}</p>
                  {(() => {
                    const van = vans.find(v => v.id === selectedBooking.vanScheduleId);
                    return (
                      <>
                        <p className="text-gray-600 text-xs" suppressHydrationWarning>
                          {van?.departureTime ? formatThaiDate(new Date(van.departureTime), true) : 'N/A'}
                        </p>
                        <p className="text-gray-900">
                          <span className="text-gray-500">จุดขึ้นรถ:</span>{' '}
                          <span className="font-medium">{van?.pickupLocation || 'N/A'}</span>
                        </p>
                      </>
                    );
                  })()}
                  <div className="flex space-x-4 mt-2">
                    {selectedBooking.seatNumber && <div className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold">ที่นั่ง {selectedBooking.seatNumber}</div>}
                    {selectedBooking.tentsCount > 0 && <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">เต็นท์ {selectedBooking.tentsCount} หลัง</div>}
                  </div>
                </div>
              </div>

              {/* Insurance Info - Full Width */}
              <div className="md:col-span-3 bg-white p-5 rounded-xl border-2 border-emerald-100">
                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2" /> ข้อมูลสำหรับทำประกันอุบัติเหตุ
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs">คำนำหน้า / ชื่อ-สกุล</p>
                    <p className="font-medium text-gray-900">{selectedBooking.prefix || '-'} {selectedBooking.fullName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs">เลขบัตรประชาชน</p>
                    <p className="font-medium text-gray-900">{selectedBooking.idCardNumber || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs">อายุ / วันเกิด</p>
                    <p className="font-medium text-gray-900">{selectedBooking.age || '-'} ปี ({selectedBooking.dateOfBirth || '-'})</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs">กรุ๊ปเลือด</p>
                    <p className="font-medium text-gray-900">{selectedBooking.bloodType || '-'}</p>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <p className="text-gray-500 text-xs flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> โรคประจำตัว</p>
                    <p className="font-medium text-gray-900">{selectedBooking.chronicDisease || 'ไม่มี'}</p>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <p className="text-gray-500 text-xs flex items-center"><Heart className="w-3 h-3 mr-1" /> อาหารที่แพ้</p>
                    <p className="font-medium text-gray-900">{selectedBooking.foodAllergy || 'ไม่มี'}</p>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <p className="text-gray-500 text-xs flex items-center"><PhoneCall className="w-3 h-3 mr-1" /> ผู้ติดต่อฉุกเฉิน</p>
                    <p className="font-medium text-gray-900">{selectedBooking.emergencyContactName || '-'} ({selectedBooking.emergencyContactPhone || '-'})</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3 border-t border-gray-200 pt-6">
              {selectedBooking.status !== 'Cancelled' && (
                <button onClick={() => setBookingToCancel(selectedBooking)} className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700">ยกเลิกการจอง</button>
              )}
              <button onClick={() => setBookingToDelete(selectedBooking)} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">ลบการจอง</button>
              <button onClick={() => setSelectedBooking(null)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {bookingToCancel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8 transform transition-all">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-100 rounded-full mb-4">
              <XCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 text-center mb-2">ยืนยันการยกเลิกการจอง</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองของ <span className="font-semibold text-gray-700">{bookingToCancel.fullName}</span>?<br/>
              ที่นั่งจะถูกคืนให้ว่างอีกครั้งและไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => setBookingToCancel(null)} 
                disabled={isCancelling}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button 
                onClick={confirmCancelBooking} 
                disabled={isCancelling}
                className="px-4 py-2 bg-yellow-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 flex items-center"
              >
                {isCancelling ? 'กำลังดำเนินการ...' : 'ยืนยันการยกเลิก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      {bookingToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8 transform transition-all">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 text-center mb-2">ยืนยันการลบการจอง</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการลบการจองของ <span className="font-semibold text-gray-700">{bookingToDelete.fullName}</span>?<br/>
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => setBookingToDelete(null)} 
                disabled={isDeleting}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button 
                onClick={confirmDeleteBooking} 
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center"
              >
                {isDeleting ? 'กำลังดำเนินการ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
      />
    </div>
  );
}
