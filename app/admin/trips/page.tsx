'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SerializedTrip, SerializedVanSchedule } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import { formatThaiDate, formatTripDateRange } from '@/lib/utils';
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar } from 'lucide-react';
import { Modal } from '@/components/Modal';

export default function AdminTrips() {
  const [trips, setTrips] = useState<SerializedTrip[]>([]);
  const [vans, setVans] = useState<SerializedVanSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<SerializedTrip | null>(null);

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

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    difficulty: 'Medium',
    date: '',
    durationDays: 1,
    pricePerPerson: 0,
    tentPrice: 0,
    totalCapacity: 10,
    tentCapacity: 0,
    thumbnailUrl: '',
    isActive: true
  });

  const fetchData = async (isMounted = true) => {
    try {
      const tripsSnapshot = await getDocs(collection(db, 'trips'));
      if (isMounted) {
        const data = tripsSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            date: d.date?.toMillis?.() || null,
            createdAt: d.createdAt?.toMillis?.() || null,
          };
        }) as SerializedTrip[];
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setTrips(data);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'trips');
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
      handleFirestoreError(error, OperationType.GET, 'vanSchedules');
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

  const handleOpenModal = (trip?: SerializedTrip) => {
    if (trip) {
      setEditingTrip(trip);
      setFormData({
        name: trip.name,
        description: trip.description,
        location: trip.location,
        difficulty: trip.difficulty,
        date: trip.date ? new Date(trip.date).toISOString().slice(0, 16) : '',
        durationDays: trip.durationDays,
        pricePerPerson: trip.pricePerPerson,
        tentPrice: trip.tentPrice || 0,
        totalCapacity: trip.totalCapacity,
        tentCapacity: trip.tentCapacity || 0,
        thumbnailUrl: trip.thumbnailUrl || '',
        isActive: trip.isActive
      });
    } else {
      setEditingTrip(null);
      setFormData({
        name: '',
        description: '',
        location: '',
        difficulty: 'Medium',
        date: '',
        durationDays: 1,
        pricePerPerson: 0,
        tentPrice: 0,
        totalCapacity: 10,
        tentCapacity: 0,
        thumbnailUrl: '',
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tripData = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        difficulty: formData.difficulty,
        date: new Date(formData.date),
        durationDays: Number(formData.durationDays),
        pricePerPerson: Number(formData.pricePerPerson),
        tentPrice: Number(formData.tentPrice),
        totalCapacity: Number(formData.totalCapacity),
        tentCapacity: Number(formData.tentCapacity),
        thumbnailUrl: formData.thumbnailUrl,
        isActive: formData.isActive,
      };

      if (editingTrip) {
        await updateDoc(doc(db, 'trips', editingTrip.id), tripData);
      } else {
        await addDoc(collection(db, 'trips'), {
          ...tripData,
          bookedSeats: 0,
          bookedTents: 0,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      fetchData();
      setModalConfig({
        isOpen: true,
        title: 'สำเร็จ',
        message: editingTrip ? 'แก้ไขข้อมูลทริปเรียบร้อยแล้ว' : 'สร้างทริปใหม่เรียบร้อยแล้ว',
        type: 'success'
      });
    } catch (error) {
      setModalConfig({
        isOpen: true,
        title: 'ข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
        type: 'alert'
      });
      handleFirestoreError(error, editingTrip ? OperationType.UPDATE : OperationType.CREATE, 'trips');
    }
  };

  const handleDelete = (id: string, bookedSeats: number) => {
    if (bookedSeats > 0) {
      setModalConfig({
        isOpen: true,
        title: 'ไม่สามารถลบได้',
        message: 'ไม่สามารถลบทริปที่มีการจองได้ กรุณายกเลิกการจองทั้งหมดก่อน',
        type: 'alert'
      });
      return;
    }

    const tripVans = vans.filter(v => v.tripId === id);
    if (tripVans.length > 0) {
      setModalConfig({
        isOpen: true,
        title: 'ไม่สามารถลบได้',
        message: `ไม่สามารถลบทริปได้เนื่องจากมีรอบรถตู้ (${tripVans.length} รอบ) ผูกอยู่ กรุณาลบรอบรถตู้ก่อน`,
        type: 'alert'
      });
      return;
    }

    setModalConfig({
      isOpen: true,
      title: 'ยืนยันการลบ',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบทริปนี้? ข้อมูลจะถูกลบถาวร',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'trips', id));
          fetchData();
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          setModalConfig({
            isOpen: true,
            title: 'ข้อผิดพลาด',
            message: 'เกิดข้อผิดพลาดในการลบข้อมูล',
            type: 'alert'
          });
          handleFirestoreError(error, OperationType.DELETE, `trips/${id}`);
        }
      }
    });
  };

  const handleToggleActive = async (trip: SerializedTrip) => {
    try {
      await updateDoc(doc(db, 'trips', trip.id), { isActive: !trip.isActive });
      fetchData();
    } catch (error) {
      setModalConfig({
        isOpen: true,
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถอัปเดตสถานะทริปได้ในขณะนี้',
        type: 'alert'
      });
      handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}`);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
          <div className="h-12 bg-gray-50 border-b border-gray-200"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 border-b border-gray-200 flex items-center px-6 space-x-4">
              <div className="h-10 w-10 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">จัดการทริป</h1>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-emerald-600 text-white px-4 py-2 rounded-md font-medium hover:bg-emerald-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          สร้างทริปใหม่
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ทริป</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ราคา (รถ/เต็นท์)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ที่นั่ง/เต็นท์</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trips.map(trip => (
                <tr key={trip.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 relative rounded-md overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={trip.thumbnailUrl || `https://picsum.photos/seed/${trip.id}/100/100`} alt="" className="object-cover h-full w-full" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{trip.name}</div>
                        <div className="text-sm text-gray-500">{trip.location}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center" suppressHydrationWarning>
                      <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                      {trip.date ? formatTripDateRange(new Date(trip.date), trip.durationDays) : 'รอประกาศ'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1" suppressHydrationWarning>เริ่ม: {trip.date ? formatThaiDate(new Date(trip.date), true) : '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ฿{(trip.pricePerPerson || 0).toLocaleString()} / ฿{(trip.tentPrice || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-gray-500 mb-1">รถ: {trip.bookedSeats} / {trip.totalCapacity}</div>
                    <div className="w-full bg-gray-200 rounded-full h-1 mb-2">
                      <div className="bg-emerald-600 h-1 rounded-full" style={{ width: `${Math.min(100, (trip.bookedSeats / trip.totalCapacity) * 100)}%` }}></div>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">เต็นท์: {trip.bookedTents || 0} / {trip.tentCapacity || 0}</div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="bg-blue-600 h-1 rounded-full" style={{ width: `${Math.min(100, ((trip.bookedTents || 0) / (trip.tentCapacity || 1)) * 100)}%` }}></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => handleToggleActive(trip)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${trip.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {trip.isActive ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                      {trip.isActive ? 'เปิดรับ' : 'ซ่อน'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleOpenModal(trip)} className="text-indigo-600 hover:text-indigo-900 mr-4" title="แก้ไขทริป"><Edit className="h-4 w-4" /></button>
                    <button 
                      onClick={() => handleDelete(trip.id, trip.bookedSeats)} 
                      className={`${trip.bookedSeats > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                      title={trip.bookedSeats > 0 ? "ไม่สามารถลบทริปที่มีการจองได้" : "ลบทริป"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingTrip ? 'แก้ไขทริป' : 'สร้างทริปใหม่'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">ชื่อทริป</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">รายละเอียด</label>
                  <textarea required rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">สถานที่</label>
                  <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ระดับความยาก</label>
                  <select value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                    <option value="Easy">ง่าย (Easy)</option>
                    <option value="Medium">ปานกลาง (Medium)</option>
                    <option value="Hard">ยาก (Hard)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">วันที่และเวลาเริ่ม</label>
                  <input required type="datetime-local" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ระยะเวลา (วัน)</label>
                  <input required type="number" min="1" value={formData.durationDays} onChange={e => setFormData({...formData, durationDays: Number(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ราคาต่อท่าน (฿)</label>
                  <input required type="number" min="0" value={formData.pricePerPerson} onChange={e => setFormData({...formData, pricePerPerson: Number(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ราคาเต็นท์ (฿)</label>
                  <input required type="number" min="0" value={formData.tentPrice} onChange={e => setFormData({...formData, tentPrice: Number(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">จำนวนที่นั่งทั้งหมด</label>
                  <input required type="number" min="1" value={formData.totalCapacity} onChange={e => setFormData({...formData, totalCapacity: Number(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">จำนวนเต็นท์ทั้งหมด</label>
                  <input required type="number" min="0" value={formData.tentCapacity} onChange={e => setFormData({...formData, tentCapacity: Number(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">URL รูปภาพ (ไม่บังคับ)</label>
                  <input type="url" value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="https://..." />
                </div>
                <div className="md:col-span-2 flex items-center mt-2">
                  <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded" />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">เปิดใช้งาน (แสดงต่อสาธารณะ)</label>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">ยกเลิก</button>
                <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700">บันทึกทริป</button>
              </div>
            </form>
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
