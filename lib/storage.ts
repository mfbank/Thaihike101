import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadPaymentProof(file: File, bookingId: string): Promise<string> {
  const fileExtension = file.name.split('.').pop();
  const fileName = `payment_proofs/${bookingId}_${Date.now()}.${fileExtension}`;
  const storageRef = ref(storage, fileName);
  
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
}
