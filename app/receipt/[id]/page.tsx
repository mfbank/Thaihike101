'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { CheckCircle, MapPin, Calendar, Clock, Download, ArrowLeft } from 'lucide-react';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import { toPng } from 'html-to-image';
import { QRCodeCanvas } from 'qrcode.react';
import { Modal } from '@/components/Modal';
import { SerializedTrip, SerializedBooking, SerializedVanSchedule } from '@/types';

export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<SerializedBooking | null>(null);
  const [trip, setTrip] = useState<SerializedTrip | null>(null);
  const [vanSchedule, setVanSchedule] = useState<SerializedVanSchedule | null>(null);
  const [loading, setLoading] = useState(true);

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

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
        if (!bookingDoc.exists()) throw new Error('Booking not found');
        const bData = bookingDoc.data();
        const bookingData = { 
          id: bookingDoc.id, 
          ...bData,
          createdAt: bData.createdAt?.toMillis() || null
        } as SerializedBooking;
        
        if (isMounted) {
          setBooking(bookingData);
        }

        const [tripDoc, vanDoc] = await Promise.all([
          getDoc(doc(db, 'trips', bookingData.tripId)),
          getDoc(doc(db, 'vanSchedules', bookingData.vanScheduleId))
        ]);

        if (isMounted) {
          if (tripDoc.exists()) {
            const tData = tripDoc.data();
            setTrip({ 
              id: tripDoc.id, 
              ...tData,
              date: tData.date?.toMillis() || null,
              createdAt: tData.createdAt?.toMillis() || null
            } as SerializedTrip);
          }
          if (vanDoc.exists()) {
            const vData = vanDoc.data();
            setVanSchedule({ 
              id: vanDoc.id, 
              ...vData,
              departureTime: vData.departureTime?.toMillis() || null,
              createdAt: vData.createdAt?.toMillis() || null
            } as SerializedVanSchedule);
          }
        }

      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `bookings/${bookingId}`);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      const dataUrl = await toPng(receiptRef.current, { 
        pixelRatio: 2,
        cacheBust: true,
        width: receiptRef.current.offsetWidth,
        height: receiptRef.current.offsetHeight,
        style: {
          margin: '0',
        }
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Receipt_${bookingId}.png`;
      link.click();
    } catch (error) {
      console.error('Failed to download receipt', error);
      setModalConfig({
        isOpen: true,
        title: 'ดาวน์โหลดล้มเหลว',
        message: 'ไม่สามารถดาวน์โหลดใบเสร็จได้ในขณะนี้: ' + (error instanceof Error ? error.message : 'โปรดลองอีกครั้ง'),
        type: 'alert'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <p className="text-gray-500 animate-pulse">กำลังโหลดใบเสร็จ...</p>
        <button 
          onClick={() => window.location.reload()}
          className="text-xs text-emerald-600 hover:underline"
        >
          โหลดนานเกินไป? คลิกเพื่อรีเฟรช
        </button>
      </div>
    );
  }

  if (!booking || !trip || !vanSchedule) {
    return <div className="text-center py-12">ไม่พบใบเสร็จรับเงิน</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button onClick={() => router.push('/')} className="flex items-center text-emerald-600 hover:text-emerald-700 mb-8 font-medium">
        <ArrowLeft className="h-4 w-4 mr-2" />
        กลับสู่หน้าหลัก
      </button>

      <div className="flex justify-end mb-4">
        <button 
          onClick={downloadReceipt}
          className="flex items-center text-sm font-medium text-gray-700 bg-white border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 shadow-sm"
        >
          <Download className="h-4 w-4 mr-2" />
          ดาวน์โหลดใบเสร็จ
        </button>
      </div>

      <div className="flex justify-center">
        <div ref={receiptRef} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden w-full max-w-[400px]">
          {/* Header */}
          <div className="bg-emerald-600 px-4 py-4 text-center text-white flex items-center justify-center space-x-2">
            <CheckCircle className="h-6 w-6 text-emerald-200" />
            <h1 className="text-xl font-bold">ยืนยันการจองสำเร็จ</h1>
          </div>

        {/* Content */}
        <div className="p-5">
          {/* Top Row: Ref & Date */}
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">รหัสอ้างอิง</p>
              <p className="text-sm font-mono font-bold text-gray-900">{booking.id.toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">วันที่</p>
              <p className="text-sm font-medium text-gray-900" suppressHydrationWarning>{booking.createdAt ? format(new Date(booking.createdAt), 'PP') : 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100">
            <div className="col-span-2 space-y-4">
              {/* Trip & Van */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">ทริป: {trip.name}</h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex items-center" suppressHydrationWarning><Calendar className="h-3 w-3 mr-1 text-emerald-600" /> {trip.date ? format(new Date(trip.date), 'PP') : 'รอประกาศ'} ({trip.durationDays} วัน)</div>
                  <div className="flex items-center" suppressHydrationWarning><Clock className="h-3 w-3 mr-1 text-emerald-600" /> ออกเดินทาง: {vanSchedule.departureTime ? format(new Date(vanSchedule.departureTime), 'PPp') : 'รอประกาศ'}</div>
                  <div className="flex items-center"><MapPin className="h-3 w-3 mr-1 text-emerald-600" /> จุดขึ้นรถ: {vanSchedule.pickupLocation}</div>
                  {booking.seatNumber && <div className="flex items-center"><span className="font-medium text-gray-900 mr-1">ที่นั่ง:</span> {booking.seatNumber}</div>}
                </div>
              </div>

              {/* Traveler & Payment */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 mb-1">ผู้เดินทาง</h3>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <p>{booking.fullName}</p>
                    <p>{booking.phoneNumber}</p>
                    <p>LINE: {booking.lineId}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 mb-1">การชำระเงิน</h3>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <p>สถานะ: <span className="text-emerald-600 font-bold">{booking.status === 'Confirmed' ? 'ยืนยันแล้ว' : booking.status === 'Pending' ? 'รอตรวจสอบ' : booking.status === 'Cancelled' ? 'ยกเลิกแล้ว' : booking.status}</span></p>
                    <p>ยอดชำระ: ฿{(booking.totalAmount || 0).toLocaleString()}</p>
                    {booking.tentsCount > 0 && (
                      <p className="text-[10px] text-gray-500 italic">
                        (ที่นั่ง ฿{(trip.pricePerPerson || 0).toLocaleString()} + เต็นท์ {booking.tentsCount} หลัง ฿{(booking.tentsCount * (trip.tentPrice || 0)).toLocaleString()})
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="col-span-1 flex flex-col items-center justify-center border-l border-gray-100 pl-4">
              <p className="text-xs font-bold text-gray-900 mb-2 text-center">กลุ่ม LINE</p>
              <div className="bg-white p-1.5 rounded-lg border border-gray-200 inline-block mb-1">
                <QRCodeCanvas value={`https://line.me/R/ti/g/mock-group-${trip.id}`} size={70} />
              </div>
              <p className="text-[10px] text-gray-500 text-center leading-tight">สแกนเพื่อเข้าร่วม<br/>กลุ่มอัปเดตทริป</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-gray-400 text-xs">
            <p>มีคำถาม? LINE: <span className="font-medium text-emerald-600">@ThaiHikeAdmin</span></p>
          </div>
        </div>
      </div>
      </div>

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
