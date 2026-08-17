
'use client';

import React from 'react';
import { CaseHistory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/firestoreService';

interface CaseHistoryPanelProps {
  caseHistory: CaseHistory[];
}

export const CaseHistoryPanel: React.FC<CaseHistoryPanelProps> = ({ caseHistory }) => {
  if (!caseHistory || caseHistory.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4">
        No case history available for this patient.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {caseHistory.map((visit) => (
        <Card key={visit.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              Visit on {formatDate(visit.visitDate, { year: 'numeric', month: 'long', day: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <h4 className="font-semibold">Complaints</h4>
                <p>{visit.complaints}</p>
              </div>
              <div>
                <h4 className="font-semibold">AI Analysis</h4>
                <p>{visit.analysis || 'N/A'}</p>
              </div>
              <div>
                <h4 className="font-semibold">Next Follow-up Date</h4>
                <p>{visit.followUpDate ? formatDate(visit.followUpDate, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
