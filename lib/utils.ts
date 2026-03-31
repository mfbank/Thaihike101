import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatThaiDate(date: Date | string | number, includeTime: boolean = false) {
  const d = new Date(date);
  const monthNames = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const day = d.getDate();
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear() + 543;
  
  let result = `${day} ${month} ${year}`;
  if (includeTime) {
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    result += ` ${hours}:${minutes}`;
  }
  return result;
}

export function formatTripDateRange(startDate: string | Date, durationDays: number) {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + (durationDays > 0 ? durationDays - 1 : 0));

  const monthNames = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const startDay = start.getDate();
  const startMonth = monthNames[start.getMonth()];
  const startYear = start.getFullYear() + 543;

  const endDay = end.getDate();
  const endMonth = monthNames[end.getMonth()];
  const endYear = end.getFullYear() + 543;

  if (startYear === endYear) {
    return `${startDay} ${startMonth} ถึง ${endDay} ${endMonth} ${startYear}`;
  }

  return `${startDay} ${startMonth} ${startYear} ถึง ${endDay} ${endMonth} ${endYear}`;
}
