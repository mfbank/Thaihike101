'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LogIn, LogOut, LayoutDashboard, Map, Bus, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Modal } from '@/components/Modal';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check if user is admin
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else if (['chankasi13@gmail.com', 'phatpcr8@gmail.com'].includes(currentUser.email || '')) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error checking admin status", error);
          // Fallback to email check if firestore fails
          if (['chankasi13@gmail.com', 'phatpcr8@gmail.com'].includes(currentUser.email || '')) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      setModalConfig({
        isOpen: true,
        title: 'เข้าสู่ระบบล้มเหลว',
        message: 'ไม่สามารถเข้าสู่ระบบได้ โปรดลองอีกครั้งในภายหลัง',
        type: 'alert'
      });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">เข้าสู่ระบบแอดมิน</h1>
          <p className="text-gray-600 mb-8">โปรดเข้าสู่ระบบด้วยบัญชี Google ที่ได้รับอนุญาตเพื่อเข้าถึงแผงควบคุมผู้ดูแลระบบ</p>
          <button
            onClick={handleLogin}
            className="w-full flex justify-center items-center bg-emerald-600 text-white px-6 py-3 rounded-md font-medium hover:bg-emerald-700 transition-colors"
          >
            <LogIn className="h-5 w-5 mr-2" />
            เข้าสู่ระบบด้วย Google
          </button>
          {user && !isAdmin && (
            <p className="mt-4 text-red-600 text-sm font-medium">
              ปฏิเสธการเข้าถึง บัญชีของคุณ ({user.email}) ไม่ได้รับอนุญาตให้เป็นผู้ดูแลระบบ
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center md:block">
          <div>
            <h2 className="text-xl font-bold text-gray-900">แผงควบคุม</h2>
            <p className="text-sm text-gray-500 mt-1 hidden md:block">{user.email}</p>
          </div>
          <div className="md:hidden">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-md font-medium transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        <nav className="flex-1 p-4 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible space-x-2 md:space-x-0 md:space-y-2">
          <Link href="/admin" className="flex items-center px-4 py-2 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md font-medium transition-colors whitespace-nowrap">
            <LayoutDashboard className="h-5 w-5 mr-3" />
            ภาพรวม
          </Link>
          <Link href="/admin/bookings" className="flex items-center px-4 py-2 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md font-medium transition-colors whitespace-nowrap">
            <Users className="h-5 w-5 mr-3" />
            การจอง
          </Link>
          <Link href="/admin/trips" className="flex items-center px-4 py-2 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md font-medium transition-colors whitespace-nowrap">
            <Map className="h-5 w-5 mr-3" />
            ทริป
          </Link>
          <Link href="/admin/vans" className="flex items-center px-4 py-2 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md font-medium transition-colors whitespace-nowrap">
            <Bus className="h-5 w-5 mr-3" />
            รอบรถตู้
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-200 hidden md:block">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-md font-medium transition-colors"
          >
            <LogOut className="h-5 w-5 mr-2" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        {children}
      </main>

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
