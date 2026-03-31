'use client';

import { useRouter } from 'next/navigation';

interface DifficultyFilterProps {
  defaultValue: string;
}

export default function DifficultyFilter({ defaultValue }: DifficultyFilterProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const url = new URL(window.location.href);
    if (value === 'All') {
      url.searchParams.delete('difficulty');
    } else {
      url.searchParams.set('difficulty', value);
    }
    router.push(url.pathname + url.search);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="difficulty" className="text-sm font-medium text-gray-700">ระดับความยาก:</label>
      <select
        id="difficulty"
        name="difficulty"
        defaultValue={defaultValue}
        onChange={handleChange}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-md border"
      >
        <option value="All">ทุกระดับ</option>
        <option value="Easy">ง่าย</option>
        <option value="Medium">ปานกลาง</option>
        <option value="Hard">ยาก</option>
      </select>
    </div>
  );
}
