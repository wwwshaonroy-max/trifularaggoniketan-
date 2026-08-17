
import { db } from './config';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
  doc,
  writeBatch,
  Timestamp,
  collectionGroup,
  orderBy,
  getDoc,
} from 'firebase/firestore';
import type { LabelState } from '@/lib/types';

export interface Patient {
  id: string;
  serialNumber: string;
  name: string;
  lastVisit?: Timestamp;
}

export interface MedicationLabel {
  id: string;
  patientId: string;
  dateCreated: Timestamp;
  bill: number;
  serial: string;
  patientName: string;
  date: Timestamp;
  shakeMode: 'with' | 'without';
  drops: number;
  cupAmount: string;
  shakeCount?: number;
  intervalMode: string;
  interval?: number;
  mealTime: string;
  mixtureAmount: string;
  durationDays?: number;
  counseling: string[];
  labelCount: number;
  followUpDays?: number;
}


async function findOrCreatePatient(serial: string, name: string, patientId?: string): Promise<{patientId: string, batch: ReturnType<typeof writeBatch>}> {
  const patientsRef = collection(db, 'patients');
  const batch = writeBatch(db);

  // First, check if a patient with this serial number already exists.
  const serialQuery = query(patientsRef, where('serialNumber', '==', serial), limit(1));
  const serialSnapshot = await getDocs(serialQuery);

  if (!serialSnapshot.empty) {
    // A patient with this serial number exists.
    const existingPatientDoc = serialSnapshot.docs[0];
    const existingPatientRef = doc(db, 'patients', existingPatientDoc.id);
    const updateData: any = { lastVisit: serverTimestamp() };

    // Update name if it's different.
    if (existingPatientDoc.data().name !== name) {
      updateData.name = name;
    }
    
    batch.update(existingPatientRef, updateData);
    return { patientId: existingPatientDoc.id, batch };
  }
  
  // If we're here, no patient with that serial exists. Create a new one.
  // We can ignore the incoming `patientId` because the serial number is the source of truth for uniqueness.
  const newPatientRef = doc(patientsRef);
  batch.set(newPatientRef, {
    serialNumber: serial,
    name: name,
    lastVisit: serverTimestamp(),
  });

  return { patientId: newPatientRef.id, batch };
}

export async function addMedicationLabel(labelData: LabelState, bill: number): Promise<string> {
  const { patientId, batch } = await findOrCreatePatient(labelData.serial, labelData.patientName, labelData.patientId);
  
  const medicationLabelsRef = doc(collection(db, `patients/${patientId}/medicationLabels`));
  batch.set(medicationLabelsRef, {
    ...labelData,
    patientId: patientId,
    date: Timestamp.fromDate(labelData.date || new Date()),
    dateCreated: serverTimestamp(),
    bill: bill,
  });

  await batch.commit();

  return medicationLabelsRef.id;
}

export async function getPatientBySerial(serial: string): Promise<Patient | null> {
  if (!serial) return null;
  const patientsRef = collection(db, 'patients');
  const q = query(patientsRef, where('serialNumber', '==', serial), limit(1));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Patient;
  }
  return null;
}

export async function searchPatients(searchTerm: string): Promise<Patient[]> {
  if (!searchTerm || searchTerm.trim().length < 2) return [];

  const nameQuery = query(
    collection(db, 'patients'),
    where('name', '>=', searchTerm),
    where('name', '<=', searchTerm + '\uf8ff'),
    limit(10)
  );

  const serialQuery = query(
    collection(db, 'patients'),
    where('serialNumber', '>=', searchTerm),
    where('serialNumber', '<=', searchTerm + '\uf8ff'),
    limit(10)
  );

  try {
    const [nameSnapshot, serialSnapshot] = await Promise.all([
      getDocs(nameQuery),
      getDocs(serialQuery),
    ]);

    const patientsMap = new Map<string, Patient>();

    nameSnapshot.docs.forEach(doc => {
      if (!patientsMap.has(doc.id)) {
        patientsMap.set(doc.id, { id: doc.id, ...doc.data() } as Patient);
      }
    });

    serialSnapshot.docs.forEach(doc => {
      if (!patientsMap.has(doc.id)) {
        patientsMap.set(doc.id, { id: doc.id, ...doc.data() } as Patient);
      }
    });
    
    return Array.from(patientsMap.values())
      .sort((a, b) => (b.lastVisit?.toMillis() ?? 0) - (a.lastVisit?.toMillis() ?? 0))
      .slice(0, 10);
      
  } catch (error) {
    console.error("Error searching patients: ", error);
    return [];
  }
}

export async function getDailyReport(date: Date): Promise<MedicationLabel[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const startMillis = startOfDay.getTime();

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const endMillis = endOfDay.getTime();

  const labelsRef = collectionGroup(db, 'medicationLabels');
  const q = query(labelsRef);

  try {
    const querySnapshot = await getDocs(q);
    const allLabels = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MedicationLabel);

    const filteredData = allLabels.filter(label => {
      if (label.dateCreated) {
        const labelMillis = label.dateCreated.toMillis();
        return labelMillis >= startMillis && labelMillis <= endMillis;
      }
      return false;
    });

    return filteredData.sort((a, b) => (a.dateCreated?.toMillis() ?? 0) - (b.dateCreated?.toMillis() ?? 0));
  } catch (error) {
     console.error("Error fetching daily report:", error);
     throw new Error(`রিপোর্ট আনতে সমস্যা হয়েছে: ${error instanceof Error ? error.message : String(error)}`);
  }
}
