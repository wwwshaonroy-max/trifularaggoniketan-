
'use client';

import { db } from './config';
import { enableIndexedDbPersistence } from 'firebase/firestore';

// This file is intended to be imported once in a client-side component,
// such as the root layout, to initialize client-specific Firebase features.

if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db)
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        // This can happen if multiple tabs are open.
        console.warn('Firebase persistence failed: multiple tabs open. Some offline features may not work.');
      } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence.
        console.warn('Firebase persistence not available in this browser.');
      }
    });
}
