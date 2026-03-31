import Link from 'next/link';
import { Mountain } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex-shrink-0 flex items-center gap-2">
              <Mountain className="h-8 w-8 text-emerald-600" />
              <span className="font-bold text-xl text-gray-900">เดินกากแต่ปากเก่ง</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
