'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SerializedVanSchedule, SerializedTrip } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/firestore-error';
import { formatThaiDate } from '@/lib/utils';
import { Plus, Edit, Trash2, Bus } from 'lucide-react';
import { Modal } from '@/components/Modal';

export default function AdminVans() {
  const [vans, setVans] = useState<SerializedVanSchedule[]>([]);
  const [trips, setTrips] = useState<SerializedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVan, setEditingVan] = useState<SerializedVanSchedule | null>(null);

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
    tripId: '',
    departureTime: '',
    pickupLocation: 'BTS หมอชิต',
    capacity: 9,
    vanNumber: 1,
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
        const data = vansSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            departureTime: d.departureTime?.toMillis?.() || null,
            createdAt: d.createdAt?.toMillis?.() || null,
          };
        }) as SerializedVanSchedule[];
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setVans(data);
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

  const handleOpenModal = (van?: SerializedVanSchedule) => {
    if (van) {
      setEditingVan(van);
      setFormData({
        tripId: van.tripId,
        departureTime: van.departureTime ? new Date(van.departureTime).toISOString().slice(0, 16) : '',
        pickupLocation: van.pickupLocation || 'BTS หมอชิต',
        capacity: van.capacity,
        vanNumber: van.vanNumber || 1,
      });
    } else {
      setEditingVan(null);
      setFormData({
        tripId: trips.length > 0 ? trips[0].id : '',
        departureTime: '',
        pickupLocation: 'BTS หมอชิต',
        capacity: 9,
        vanNumber: 1,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const vanData = {
        tripId: formData.tripId,
        departureTime: new Date(formData.departureTime),
        pickupLocation: formData.pickupLocation,
        capacity: Number(formData.capacity),
        vanNumber: Number(formData.vanNumber),
      };

      if (editingVan) {
        await updateDoc(doc(db, 'vanSchedules', editingVan.id), vanData);
      } else {
        await addDoc(collection(db, 'vanSchedules'), {
          ...vanData,
          bookedSeats: 0,
          bookedSeatsList: [],
          seatNicknames: {},
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      fetchData();
      setModalConfig({
        isOpen: true,
        title: 'สำเร็จ',
        message: editingVan ? 'แก้ไขข้อมูลรอบรถตู้เรียบร้อยแล้ว' : 'สร้างรอบรถตู้ใหม่เรียบร้อยแล้ว',
        type: 'success'
      });
    } catch (error) {
      setModalConfig({
        isOpen: true,
        title: 'ข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
        type: 'alert'
      });
      handleFirestoreError(error, editingVan ? OperationType.UPDATE : OperationType.CREATE, 'vanSchedules');
    }
  };

  const handleDelete = (id: string, bookedSeats: number) => {
    if (bookedSeats > 0) {
      setModalConfig({
        isOpen: true,
        title: 'ไม่สามารถลบได้',
        message: 'ไม่สามารถลบรอบรถตู้ที่มีการจองแล้วได้',
        type: 'alert'
      });
      return;
    }
    
    setModalConfig({
      isOpen: true,
      title: 'ยืนยันการลบ',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบรอบรถตู้นี้? ข้อมูลจะถูกลบถาวร',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'vanSchedules', id));
          fetchData();
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          setModalConfig({
            isOpen: true,
            title: 'ข้อผิดพลาด',
            message: 'เกิดข้อผิดพลาดในการลบข้อมูล',
            type: 'alert'
          });
          handleFirestoreError(error, OperationType.DELETE, `vanSchedules/${id}`);
        }
      }
    });
  };

  const handleBulkCreate = async () => {
    if (!formData.tripId || !formData.departureTime) {
      setModalConfig({
        isOpen: true,
        title: 'ข้อมูลไม่ครบ',
        message: 'กรุณาเลือกทริปและเวลาออกเดินทางก่อน',
        type: 'alert'
      });
      return;
    }

    setModalConfig({
      isOpen: true,
      title: 'ยืนยันการสร้างแบบกลุ่ม',
      message: 'ระบบจะสร้างรถตู้ 4 คันสำหรับ BTS หมอชิต และ 4 คันสำหรับ Central ชลบุรี (รวม 8 คัน) ยืนยันหรือไม่?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          const locations = ['BTS หมอชิต', 'Central ชลบุรี'];
          const departureDate = new Date(formData.departureTime);
          
          for (const loc of locations) {
            for (let i = 1; i <= 4; i++) {
              await addDoc(collection(db, 'vanSchedules'), {
                tripId: formData.tripId,
                departureTime: departureDate,
                pickupLocation: loc,
                capacity: 9,
                vanNumber: i,
                bookedSeats: 0,
                bookedSeatsList: [],
                seatNicknames: {},
                createdAt: serverTimestamp()
              });
            }
          }

          setIsModalOpen(false);
          setModalConfig({
            isOpen: true,
            title: 'สำเร็จ',
            message: 'สร้างรอบรถตู้ 8 คันเรียบร้อยแล้ว',
            type: 'success'
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'vanSchedules');
        }
      }
    });
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
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
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
        <h1 className="text-3xl font-bold text-gray-900">จัดการรอบรถตู้</h1>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-emerald-600 text-white px-4 py-2 rounded-md font-medium hover:bg-emerald-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          สร้างรอบรถตู้
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ทริป / คันที่</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เวลาออกเดินทาง</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จุดขึ้นรถ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ที่นั่ง</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vans.map(van => {
                const trip = trips.find(t => t.id === van.tripId);
                return (
                  <tr key={van.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{trip?.name || 'ไม่ทราบทริป'}</div>
                      <div className="text-xs text-emerald-600 font-semibold flex items-center mt-1">
                        <Bus className="w-3 h-3 mr-1" /> รถคันที่ {van.vanNumber || 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900" suppressHydrationWarning>{van.departureTime ? formatThaiDate(new Date(van.departureTime), true) : 'รอประกาศ'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {van.pickupLocation}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{van.bookedSeats} / {van.capacity}</div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, (van.bookedSeats / van.capacity) * 100)}%` }}></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleOpenModal(van)} className="text-indigo-600 hover:text-indigo-900 mr-4" title="แก้ไขรอบรถตู้"><Edit className="h-4 w-4" /></button>
                      <button 
                        onClick={() => handleDelete(van.id, van.bookedSeats)} 
                        className={`${van.bookedSeats > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                        title={van.bookedSeats > 0 ? "ไม่สามารถลบรอบรถตู้ที่มีการจองได้" : "ลบรอบรถตู้"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingVan ? 'แก้ไขรอบรถตู้' : 'สร้างรอบรถตู้ใหม่'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ทริป</label>
                <select required value={formData.tripId} onChange={e => setFormData({...formData, tripId: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                  <option value="" disabled>เลือกทริป</option>
                  {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">รถคันที่</label>
                  <select required value={formData.vanNumber} onChange={e => setFormData({...formData, vanNumber: Number(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                    {[1, 2, 3, 4].map(num => (
                      <option key={num} value={num}>คันที่ {num}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ความจุ (ที่นั่ง)</label>
                  <input required type="number" min="1" value={formData.capacity} onChange={e => setFormData({...formData, capacity: Number(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">เวลาออกเดินทาง</label>
                <input required type="datetime-local" value={formData.departureTime} onChange={e => setFormData({...formData, departureTime: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">จุดขึ้นรถ</label>
                <select required value={formData.pickupLocation} onChange={e => setFormData({...formData, pickupLocation: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                  <option value="BTS หมอชิต">BTS หมอชิต</option>
                  <option value="Central ชลบุรี">Central ชลบุรี</option>
                </select>
              </div>
              <div className="mt-6 flex flex-col space-y-3">
                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">ยกเลิก</button>
                  <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700">บันทึกรอบรถตู้</button>
                </div>
                {!editingVan && (
                  <button 
                    type="button" 
                    onClick={handleBulkCreate}
                    className="w-full bg-orange-100 text-orange-700 border border-orange-200 px-4 py-2 rounded-md hover:bg-orange-200 font-medium transition-colors"
                  >
                    สร้างแบบกลุ่ม (4 คัน x 2 จุด = 8 คัน)
                  </button>
                )}
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
