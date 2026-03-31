import { Timestamp } from 'firebase/firestore';

export interface Trip {
  id: string;
  name: string;
  description: string;
  location: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  date: Timestamp | null;
  durationDays: number;
  pricePerPerson: number;
  tentPrice: number;
  totalCapacity: number;
  bookedSeats: number;
  tentCapacity: number;
  bookedTents: number;
  thumbnailUrl?: string;
  isActive: boolean;
  createdAt: Timestamp | null;
}

export interface SerializedTrip extends Omit<Trip, 'date' | 'createdAt'> {
  date: number | null;
  createdAt: number | null;
}

export interface Booking {
  id: string;
  tripId: string;
  vanScheduleId: string;
  fullName: string;
  nickname: string;
  phoneNumber: string;
  lineId: string;
  status: 'Confirmed' | 'Cancelled' | string;
  createdAt: Timestamp | null;
  totalAmount: number;
  seatNumber: string;
  tentsCount: number;
  equipment?: {
    tentSet?: number;
    tent?: number;
    sleepingBag?: number;
    sleepingPad?: number;
    pillow?: number;
    trekkingPole?: number;
  };
  prefix?: string;
  idCardNumber?: string;
  age?: number;
  dateOfBirth?: string;
  bloodType?: string;
  chronicDisease?: string;
  foodAllergy?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface VanSchedule {
  id: string;
  tripId: string;
  vanNumber: number;
  capacity: number;
  bookedSeats: number;
  bookedSeatsList: string[];
  seatNicknames?: Record<string, string>;
  departureTime: Timestamp | null;
  pickupLocation: string;
  isActive: boolean;
  createdAt: Timestamp | null;
}

export interface SerializedVanSchedule extends Omit<VanSchedule, 'departureTime' | 'createdAt'> {
  departureTime: number | null;
  createdAt: number | null;
}

export interface SerializedBooking extends Omit<Booking, 'createdAt'> {
  createdAt: number | null;
}
