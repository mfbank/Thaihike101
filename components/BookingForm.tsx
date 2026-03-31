'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, serverTimestamp, runTransaction, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SerializedTrip, SerializedVanSchedule } from '@/types';
import { formatThaiDate, formatTripDateRange } from '@/lib/utils';
import { CheckCircle, ArrowLeft, MapPin, Calendar, Clock, Users } from 'lucide-react';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import { Modal } from '@/components/Modal';
import { QRCodeSVG } from 'qrcode.react';

interface BookingFormProps {
  trip: SerializedTrip;
  schedules: SerializedVanSchedule[];
}

export default function BookingForm({ trip, schedules }: BookingFormProps) {
  const router = useRouter();
  const tripId = trip.id;

  const [step, setStep] = useState<number>(1);
  const [selectedVanId, setSelectedVanId] = useState<string>('');
  const [selectedSeat, setSelectedSeat] = useState<string>('');

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
  
  const [equipment, setEquipment] = useState({
    tentSet: 0,
    tent: 0,
    sleepingBag: 0,
    sleepingPad: 0,
    pillow: 0,
    trekkingPole: 0
  });

  const [insuranceInfo, setInsuranceInfo] = useState({
    prefix: '',
    idCardNumber: '',
    age: '',
    dateOfBirth: '',
    bloodType: '',
    chronicDisease: '',
    foodAllergy: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
  });

  const equipmentPrices = {
    tentSet: 500,
    tent: 300,
    sleepingBag: 100,
    sleepingPad: 70,
    pillow: 50,
    trekkingPole: 150
  };

  const calculateEquipmentTotal = () => {
    return (
      equipment.tentSet * equipmentPrices.tentSet +
      equipment.tent * equipmentPrices.tent +
      equipment.sleepingBag * equipmentPrices.sleepingBag +
      equipment.sleepingPad * equipmentPrices.sleepingPad +
      equipment.pillow * equipmentPrices.pillow +
      equipment.trekkingPole * equipmentPrices.trekkingPole
    );
  };
  
  const [userInfo, setUserInfo] = useState({
    fullName: '',
    nickname: '',
    phoneNumber: '',
    lineId: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedSchedules = [...schedules].sort((a, b) => (a.vanNumber || 0) - (b.vanNumber || 0));

  const selectedVan = sortedSchedules.find(s => s.id === selectedVanId);

  const handleNextStep = () => {
    if (step === 1 && !selectedVanId) {
      setModalConfig({
        isOpen: true,
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาเลือกรอบรถตู้ก่อนดำเนินการต่อ',
        type: 'alert'
      });
      return;
    }
    if (step === 2 && !selectedSeat) {
      setModalConfig({
        isOpen: true,
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาเลือกที่นั่งก่อนดำเนินการต่อ',
        type: 'alert'
      });
      return;
    }
    if (step === 3) {
      if (!userInfo.nickname || !userInfo.phoneNumber || !userInfo.lineId || 
          !userInfo.fullName || !insuranceInfo.prefix || !insuranceInfo.idCardNumber || 
          !insuranceInfo.age || !insuranceInfo.dateOfBirth || !insuranceInfo.bloodType ||
          !insuranceInfo.emergencyContactName || !insuranceInfo.emergencyContactPhone) {
        setModalConfig({
          isOpen: true,
          title: 'ข้อมูลไม่ครบถ้วน',
          message: 'กรุณากรอกข้อมูลผู้เดินทางและข้อมูลประกันให้ครบถ้วน',
          type: 'alert'
        });
        return;
      }
      if (!/^0\d{9}$/.test(userInfo.phoneNumber)) {
        setModalConfig({
          isOpen: true,
          title: 'เบอร์โทรศัพท์ไม่ถูกต้อง',
          message: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก เริ่มต้นด้วย 0)',
          type: 'alert'
        });
        return;
      }
    }
    setStep(s => s + 1);
  };

  const handleSubmitBooking = async () => {
    if (!selectedVan || !selectedSeat) return;
    setIsSubmitting(true);

    try {
      const bookingRef = doc(collection(db, 'bookings'));
      const bookingId = bookingRef.id;

      await runTransaction(db, async (transaction) => {
        const tripDocRef = doc(db, 'trips', tripId);
        const vanDocRef = doc(db, 'vanSchedules', selectedVan.id);

        const tripDoc = await transaction.get(tripDocRef);
        const vanDoc = await transaction.get(vanDocRef);

        if (!tripDoc.exists() || !vanDoc.exists()) {
          throw new Error("ไม่พบข้อมูลทริปหรือรอบรถตู้!");
        }

        const tripData = tripDoc.data();
        const currentTripSeats = tripData.bookedSeats || 0;
        const currentTripTents = tripData.bookedTents || 0;
        const currentVanSeats = vanDoc.data().bookedSeats || 0;
        const bookedSeatsList = vanDoc.data().bookedSeatsList || [];
        const seatNicknames = vanDoc.data().seatNicknames || {};

        if (currentTripSeats >= tripData.totalCapacity) {
          throw new Error("ทริปนี้เต็มแล้ว");
        }
        if (currentVanSeats >= vanDoc.data().capacity) {
          throw new Error("รถตู้รอบที่เลือกเต็มแล้ว");
        }
        if (bookedSeatsList.includes(selectedSeat)) {
          throw new Error(`ที่นั่ง ${selectedSeat} ถูกจองแล้ว กรุณาเลือกที่นั่งอื่น`);
        }

        const totalTentsBooked = equipment.tentSet + equipment.tent;

        if (totalTentsBooked > 0) {
          if (currentTripTents + totalTentsBooked > (tripData.tentCapacity || 0)) {
            throw new Error(`เต็นท์ไม่เพียงพอ (เหลือ ${(tripData.tentCapacity || 0) - currentTripTents} หลัง)`);
          }
        }

        transaction.update(tripDocRef, { 
          bookedSeats: currentTripSeats + 1,
          bookedTents: currentTripTents + totalTentsBooked
        });
        transaction.update(vanDocRef, { 
          bookedSeats: currentVanSeats + 1,
          bookedSeatsList: [...bookedSeatsList, selectedSeat],
          seatNicknames: { ...seatNicknames, [selectedSeat]: userInfo.nickname || userInfo.fullName }
        });

        transaction.set(bookingRef, {
          tripId: trip.id,
          vanScheduleId: selectedVan.id,
          seatNumber: selectedSeat,
          tentsCount: totalTentsBooked,
          equipment: equipment,
          fullName: userInfo.fullName,
          nickname: userInfo.nickname,
          phoneNumber: userInfo.phoneNumber,
          lineId: userInfo.lineId,
          prefix: insuranceInfo.prefix,
          idCardNumber: insuranceInfo.idCardNumber,
          age: parseInt(insuranceInfo.age),
          dateOfBirth: insuranceInfo.dateOfBirth,
          bloodType: insuranceInfo.bloodType,
          chronicDisease: insuranceInfo.chronicDisease,
          foodAllergy: insuranceInfo.foodAllergy,
          emergencyContactName: insuranceInfo.emergencyContactName,
          emergencyContactPhone: insuranceInfo.emergencyContactPhone,
          totalAmount: (trip.pricePerPerson || 0) + calculateEquipmentTotal(),
          status: 'Confirmed',
          createdAt: serverTimestamp()
        });
      });

      router.push(`/receipt/${bookingId}`);

    } catch (error) {
      console.error(error);
      setModalConfig({
        isOpen: true,
        title: 'การจองล้มเหลว',
        message: 'เกิดข้อผิดพลาดในการจอง: ' + (error instanceof Error ? error.message : 'โปรดลองอีกครั้งในภายหลัง'),
        type: 'alert'
      });
      setIsSubmitting(false);
      handleFirestoreError(error, OperationType.WRITE, 'bookings');
    }
  };

  const totalAmount = (trip.pricePerPerson || 0) + calculateEquipmentTotal();
  const promptPayNumber = "0812345678";
  const qrValue = `promptpay://${promptPayNumber}?amount=${totalAmount.toFixed(2)}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <button onClick={() => step > 1 ? setStep(s => s - 1) : router.back()} className="flex items-center text-emerald-600 hover:text-emerald-700 mb-8 font-medium">
        <ArrowLeft className="h-4 w-4 mr-2" />
        ย้อนกลับ
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-8">
            {['เลือกรถตู้', 'เลือกที่นั่ง', 'ข้อมูลของคุณ', 'ชำระเงิน'].map((label, idx) => (
              <div key={label} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  step > idx + 1 ? 'bg-emerald-600 text-white' : 
                  step === idx + 1 ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > idx + 1 ? <CheckCircle className="h-5 w-5" /> : idx + 1}
                </div>
                <span className={`mt-2 text-xs font-medium ${step >= idx + 1 ? 'text-emerald-600' : 'text-gray-500'}`}>{label}</span>
              </div>
            ))}
          </div>

          {/* Step 1: Van Selection */}
          {step === 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">เลือกรอบรถตู้</h2>
              {sortedSchedules.length === 0 ? (
                <p className="text-gray-500">ไม่มีรอบรถตู้สำหรับทริปนี้</p>
              ) : (
                <div className="space-y-4">
                  {sortedSchedules.map(schedule => {
                    const isFull = schedule.bookedSeats >= schedule.capacity;
                    const available = schedule.capacity - schedule.bookedSeats;
                    return (
                      <label 
                        key={schedule.id} 
                        className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedVanId === schedule.id ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 
                          isFull ? 'bg-gray-50 opacity-60 cursor-not-allowed' : 'hover:bg-gray-50 border-gray-200'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="vanSchedule" 
                          value={schedule.id}
                          checked={selectedVanId === schedule.id}
                          onChange={() => !isFull && setSelectedVanId(schedule.id)}
                          disabled={isFull}
                          className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                        />
                        <div className="ml-4 flex-grow">
                          <div className="flex justify-between">
                            <span className="block text-sm font-medium text-gray-900" suppressHydrationWarning>
                              รถคันที่ {schedule.vanNumber || 1} - เวลาออกเดินทาง: {schedule.departureTime ? formatThaiDate(new Date(schedule.departureTime)) : 'รอประกาศ'}
                            </span>
                            <span className={`text-sm font-medium ${isFull ? 'text-red-500' : 'text-emerald-600'}`}>
                              {isFull ? 'เต็มแล้ว' : `เหลือ ${available} ที่นั่ง`}
                            </span>
                          </div>
                          <span className="block text-sm text-gray-500 mt-1">
                            จุดขึ้นรถ: {schedule.pickupLocation}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={handleNextStep}
                  disabled={!selectedVanId}
                  className="bg-emerald-600 text-white px-6 py-2 rounded-md font-medium hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  ดำเนินการต่อ
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Seat Selection */}
          {step === 2 && selectedVan && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">เลือกที่นั่งของคุณ</h2>
              
              <div className="mb-8 flex justify-center space-x-6 text-sm">
                <div className="flex items-center">
                  <div className="w-5 h-5 rounded bg-[#8dc63f] mr-2 border border-gray-300"></div> ว่าง
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 rounded bg-[#f05a28] mr-2 border border-gray-300"></div> เลือกแล้ว
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 rounded bg-[#a7a9ac] mr-2 border border-gray-300"></div> จองแล้ว
                </div>
              </div>
              
              {/* Van UI Container */}
              <div className="max-w-[340px] mx-auto bg-[#cfd0d2] pt-8 pb-12 px-6 rounded-[4rem] border-2 border-[#a7a9ac] relative shadow-2xl">
                {/* Top curve detail */}
                <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#b8b9bb] to-transparent rounded-t-[4rem] opacity-50 pointer-events-none"></div>
                
                {/* Side mirrors */}
                <div className="absolute top-40 -left-3 w-4 h-16 bg-[#273a3c] rounded-l-lg shadow-md"></div>
                <div className="absolute top-40 -right-3 w-4 h-16 bg-[#273a3c] rounded-r-lg shadow-md"></div>
                
                {/* Logo Area */}
                <div className="relative h-28 flex flex-col items-center justify-center mb-2 z-10">
                  <div className="text-center relative">
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-orange-500 text-xl">⛰️</div>
                    <h1 className="text-3xl font-black text-[#273a3c] leading-none tracking-tighter flex items-end justify-center">
                      <span>เดิน</span>
                      <span className="text-5xl -mb-1 mx-0.5">ก</span>
                      <span>าก</span>
                    </h1>
                    <h2 className="text-xl font-bold text-[#273a3c] leading-none mt-1">แต่ปากเก่ง</h2>
                    <p className="text-[9px] tracking-[0.2em] text-gray-600 mt-2 font-medium">BY DOG TAGS</p>
                  </div>
                </div>

                {/* Dashboard */}
                <div className="w-full h-14 bg-[#273a3c] rounded-xl relative mb-8 flex items-center px-4 justify-between shadow-lg z-10">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#cfd0d2] opacity-80"></div>
                    <div className="w-3 h-3 rounded-full bg-[#cfd0d2] opacity-80"></div>
                  </div>
                  <div className="w-1/3 h-1.5 bg-[#cfd0d2] rounded-full opacity-50"></div>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#cfd0d2] opacity-80"></div>
                    <div className="w-3 h-3 rounded-full bg-[#cfd0d2] opacity-80"></div>
                  </div>
                </div>

                {/* Front Row: Staff & Driver */}
                <div className="grid grid-cols-2 gap-8 mb-10 px-2 relative z-10">
                  {/* Staff Seat */}
                  <div className="relative w-full aspect-square bg-gradient-to-b from-[#9ed04a] to-[#7db531] rounded-t-xl rounded-b-2xl border-b-[8px] border-x-[5px] border-[#1a1a1a] flex items-center justify-center shadow-md">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[115%] bg-[#ed1c24] border-[3px] border-white text-white flex items-center justify-between px-1.5 py-1 z-20 shadow-lg rounded-sm">
                      <div className="text-[11px] font-black leading-[1.1] text-left tracking-tight">STAFF<br/>ONLY</div>
                      <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center bg-[#ed1c24]">
                        <div className="w-2.5 h-[2px] bg-white"></div>
                      </div>
                    </div>
                  </div>

                  {/* Driver Seat */}
                  <div className="relative w-full aspect-square bg-gradient-to-b from-[#f26d3d] to-[#e54d19] rounded-t-xl rounded-b-2xl border-b-[8px] border-x-[5px] border-[#1a1a1a] shadow-md">
                    {/* Steering wheel */}
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-16 h-16 border-[5px] border-[#939598] rounded-full flex items-center justify-center z-20 bg-[#cfd0d2]/20 backdrop-blur-sm">
                      <div className="w-full h-[5px] bg-[#939598] absolute"></div>
                      <div className="w-[5px] h-1/2 bg-[#939598] absolute bottom-0"></div>
                      <div className="w-4 h-4 rounded-full border-[4px] border-[#939598] bg-[#cfd0d2] z-30"></div>
                    </div>
                  </div>
                </div>

                {/* Passenger Seats: 3-2-1, 6-5-4, 9-8-7 */}
                <div className="grid grid-cols-3 gap-x-4 gap-y-8 px-1 relative z-10">
                  {['3', '2', '1', '6', '5', '4', '9', '8', '7'].map((seat) => {
                    const isBooked = selectedVan?.bookedSeatsList?.includes(seat) || false;
                    const nickname = selectedVan?.seatNicknames?.[seat] || '';
                    const isSelected = selectedSeat === seat;
                    
                    let seatBg = 'from-[#9ed04a] to-[#7db531]'; // Available (Green)
                    if (isBooked) seatBg = 'from-[#b5b7b9] to-[#9a9c9f]'; // Booked (Gray)
                    if (isSelected) seatBg = 'from-[#f26d3d] to-[#e54d19]'; // Selected (Orange)
                    
                    return (
                      <div key={seat} className="relative flex flex-col items-center">
                        <button
                          disabled={isBooked}
                          onClick={() => setSelectedSeat(seat)}
                          className={`w-full aspect-square bg-gradient-to-b ${seatBg} rounded-t-xl rounded-b-2xl border-b-[8px] border-x-[5px] border-[#1a1a1a] transition-all relative flex flex-col items-center pt-1.5 shadow-md ${
                            !isBooked && !isSelected ? 'hover:brightness-110 hover:-translate-y-1' : ''
                          } ${isSelected ? 'ring-4 ring-[#f05a28]/50 scale-105' : ''}`}
                        >
                          {/* Seat Number Circle */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-base font-bold shadow-sm z-10 ${
                            isBooked ? 'bg-[#7a7c7f] text-white/80' : 'bg-[#50b887] text-white'
                          }`}>
                            {seat}
                          </div>

                          {/* Nickname for booked seats */}
                          {isBooked && nickname && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 rounded-t-lg rounded-b-xl backdrop-blur-[1px]">
                              <span className="text-[11px] font-bold text-white truncate px-1 w-full text-center drop-shadow-md">
                                {nickname}
                              </span>
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-10 flex justify-between items-center max-w-sm mx-auto">
                <div className="text-sm text-gray-500 italic">
                  * ที่นั่ง 1-3 อยู่แถวหน้าสุดหลังคนขับ
                </div>
                <button 
                  onClick={handleNextStep}
                  disabled={!selectedSeat}
                  className="bg-emerald-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  ดำเนินการต่อ
                </button>
              </div>
            </div>
          )}

          {/* Step 3: User Info & Equipment */}
          {step === 3 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">ข้อมูลผู้เดินทางและอุปกรณ์</h2>
              
              <div className="mb-10">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">⛺</span> อุปกรณ์ให้เช่าเพิ่มเติม
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'tentSet', label: 'เต็นท์ครบชุด', desc: 'เต็นท์ ถุงนอน แผ่นรองนอน หมอน', price: equipmentPrices.tentSet, icon: '🏕️' },
                    { id: 'tent', label: 'เต็นท์เปล่า', desc: 'นอนได้ 2 ท่าน', price: equipmentPrices.tent, icon: '⛺' },
                    { id: 'sleepingBag', label: 'ถุงนอน', desc: 'กันหนาว 15 องศา', price: equipmentPrices.sleepingBag, icon: '🛌' },
                    { id: 'sleepingPad', label: 'แผ่นรองนอน', desc: 'โฟมหนา 10mm', price: equipmentPrices.sleepingPad, icon: '🧘' },
                    { id: 'pillow', label: 'หมอนเป่าลม', desc: 'พกพาสะดวก', price: equipmentPrices.pillow, icon: '🛏️' },
                    { id: 'trekkingPole', label: 'ไม้เทรคกิ้ง', desc: 'ปรับระดับได้', price: equipmentPrices.trekkingPole, icon: '🦯' }
                  ].map((item) => {
                    const count = equipment[item.id as keyof typeof equipment];
                    return (
                    <div key={item.id} className={`flex flex-col justify-between p-4 rounded-xl border-2 transition-all ${count > 0 ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-emerald-300'}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl mr-3 shadow-sm">
                            {item.icon}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{item.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">฿{item.price}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">/ ทริป</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100/80">
                        <span className="text-sm font-medium text-gray-700">จำนวน</span>
                        <div className="flex items-center space-x-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                          <button 
                            onClick={() => setEquipment(prev => ({ ...prev, [item.id]: Math.max(0, prev[item.id as keyof typeof equipment] - 1) }))}
                            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-gray-900">{count}</span>
                          <button 
                            onClick={() => {
                              if (item.id === 'tentSet' || item.id === 'tent') {
                                const currentTents = equipment.tentSet + equipment.tent;
                                const availableTents = (trip.tentCapacity || 0) - (trip.bookedTents || 0);
                                if (currentTents >= availableTents) {
                                  setModalConfig({
                                    isOpen: true,
                                    title: 'เต็นท์เต็มแล้ว',
                                    message: `ขออภัย เต็นท์สำหรับทริปนี้เต็มแล้ว (เหลือ ${availableTents} หลัง)`,
                                    type: 'alert'
                                  });
                                  return;
                                }
                              }
                              setEquipment(prev => ({ ...prev, [item.id]: prev[item.id as keyof typeof equipment] + 1 }));
                            }}
                            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <span className="mr-2">👤</span> ข้อมูลผู้เดินทาง
                </h3>
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">ชื่อเล่น</label>
                    <input type="text" id="nickname" value={userInfo.nickname} onChange={e => setUserInfo({...userInfo, nickname: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                  </div>
                  <div>
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                    <input type="tel" id="phoneNumber" placeholder="08xxxxxxxx" value={userInfo.phoneNumber} onChange={e => setUserInfo({...userInfo, phoneNumber: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                  </div>
                  <div>
                    <label htmlFor="lineId" className="block text-sm font-medium text-gray-700">LINE ID</label>
                    <input type="text" id="lineId" value={userInfo.lineId} onChange={e => setUserInfo({...userInfo, lineId: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                  </div>
                </div>

                <div className="mt-10 bg-emerald-50 p-6 rounded-xl border border-emerald-100">
                  <h3 className="text-lg font-bold text-emerald-900 mb-4 flex items-center">
                    <span className="mr-2">🛡️</span> ข้อมูลความคุ้มครองอุบัติเหตุ
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">คำนำหน้า</label>
                      <select value={insuranceInfo.prefix} onChange={e => setInsuranceInfo({...insuranceInfo, prefix: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border">
                        <option value="">เลือก</option>
                        <option value="นาย">นาย</option>
                        <option value="นาง">นาง</option>
                        <option value="นางสาว">นางสาว</option>
                      </select>
                    </div>
                    <div className="sm:col-span-5">
                      <label className="block text-sm font-medium text-gray-700">ชื่อ-นามสกุล (ตามบัตรประชาชน)</label>
                      <input type="text" value={userInfo.fullName} onChange={e => setUserInfo({...userInfo, fullName: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">เลขบัตรประจำตัวประชาชน</label>
                      <input type="text" value={insuranceInfo.idCardNumber} onChange={e => setInsuranceInfo({...insuranceInfo, idCardNumber: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">อายุ</label>
                      <input type="number" value={insuranceInfo.age} onChange={e => setInsuranceInfo({...insuranceInfo, age: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">วัน/เดือน/ปีเกิด</label>
                      <input type="date" value={insuranceInfo.dateOfBirth} onChange={e => setInsuranceInfo({...insuranceInfo, dateOfBirth: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">หมู่เลือด</label>
                      <select value={insuranceInfo.bloodType} onChange={e => setInsuranceInfo({...insuranceInfo, bloodType: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border">
                        <option value="">เลือก</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="AB">AB</option>
                        <option value="O">O</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">โรคประจำตัว</label>
                      <input type="text" value={insuranceInfo.chronicDisease} onChange={e => setInsuranceInfo({...insuranceInfo, chronicDisease: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">แพ้อาหาร</label>
                      <input type="text" value={insuranceInfo.foodAllergy} onChange={e => setInsuranceInfo({...insuranceInfo, foodAllergy: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">ชื่อบุคคลติดต่อกรณีฉุกเฉิน</label>
                      <input type="text" value={insuranceInfo.emergencyContactName} onChange={e => setInsuranceInfo({...insuranceInfo, emergencyContactName: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">เบอร์โทรติดต่อกรณีฉุกเฉิน</label>
                      <input type="tel" value={insuranceInfo.emergencyContactPhone} onChange={e => setInsuranceInfo({...insuranceInfo, emergencyContactPhone: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-3 border" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={handleNextStep}
                  className="bg-emerald-600 text-white px-6 py-2 rounded-md font-medium hover:bg-emerald-700"
                >
                  ดำเนินการชำระเงิน
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">ชำระเงินผ่าน PromptPay</h2>
              
              <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-gray-200 mb-8">
                <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                  <QRCodeSVG value={qrValue} size={200} />
                </div>
                <p className="text-lg font-medium text-gray-900">สแกนเพื่อชำระเงิน ฿{(totalAmount || 0).toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">PromptPay: {promptPayNumber}</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-8">
                <p className="text-sm text-blue-800">
                  <strong>หมายเหตุ:</strong> หลังจากชำระเงินแล้ว กรุณากดปุ่ม &quot;ยืนยันการจอง&quot; ด้านล่างเพื่อรับใบเสร็จรับเงิน
                </p>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={handleSubmitBooking}
                  disabled={isSubmitting}
                  className="bg-emerald-600 text-white px-6 py-2 rounded-md font-medium hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      กำลังดำเนินการ...
                    </>
                  ) : 'ยืนยันการจอง'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Sidebar: Booking Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
            <h3 className="text-lg font-bold text-gray-900 mb-4">สรุปการจอง</h3>
            
            <div className="space-y-4">
              <div className="border-b border-gray-200 pb-4">
                <h4 className="font-medium text-gray-900">{trip.name}</h4>
                <div className="mt-2 text-sm text-gray-600 space-y-1">
                  <div className="flex items-center"><MapPin className="h-3 w-3 mr-1" /> {trip.location}</div>
                  <div className="flex items-center" suppressHydrationWarning><Calendar className="h-3 w-3 mr-1" /> {trip.date ? formatTripDateRange(new Date(trip.date), trip.durationDays) : 'รอประกาศ'}</div>
                </div>
              </div>

              {selectedVan && (
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="text-sm font-medium text-gray-900">รอบรถตู้</h4>
                  <div className="mt-2 text-sm text-gray-600 space-y-1">
                    <div className="flex items-center" suppressHydrationWarning><Clock className="h-3 w-3 mr-1" /> {selectedVan.departureTime ? formatThaiDate(new Date(selectedVan.departureTime)) : 'รอประกาศ'}</div>
                    <div className="flex items-center"><MapPin className="h-3 w-3 mr-1" /> {selectedVan.pickupLocation}</div>
                    {selectedSeat && <div className="flex items-center"><Users className="h-3 w-3 mr-1" /> ที่นั่ง: {selectedSeat}</div>}
                  </div>
                </div>
              )}

              {step > 3 && (
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="text-sm font-medium text-gray-900">ผู้เดินทาง</h4>
                  <div className="mt-2 text-sm text-gray-600 space-y-1">
                    <div>{userInfo.fullName} ({userInfo.nickname})</div>
                    <div>{userInfo.phoneNumber}</div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>ค่าที่นั่งรถตู้</span>
                    <span>฿{(trip.pricePerPerson || 0).toLocaleString()}</span>
                  </div>
                  {calculateEquipmentTotal() > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>ค่าอุปกรณ์เช่า</span>
                      <span>฿{calculateEquipmentTotal().toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-base font-medium text-gray-900">ยอดรวม</span>
                  <span className="text-xl font-bold text-emerald-600">฿{(totalAmount || 0).toLocaleString()}</span>
                </div>
              </div>
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
