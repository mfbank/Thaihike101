import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
      <h2 className="text-3xl font-bold text-gray-900 mb-4">404 - ไม่พบหน้าที่ต้องการ</h2>
      <p className="text-gray-600 mb-8">หน้าที่คุณกำลังค้นหาไม่มีอยู่หรือถูกลบไปแล้ว</p>
      <Link 
        href="/"
        className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
      >
        กลับสู่หน้าหลัก
      </Link>
    </div>
  );
}
