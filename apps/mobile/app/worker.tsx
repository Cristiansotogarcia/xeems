import { useState } from 'react';
import type { Shift } from '@fieldops/shared';
import { SafeAreaView, Text, Pressable, View } from 'react-native';
import { requestShiftTrackingConsent, startShiftTracking, stopShiftTracking } from '../lib/location';

const demoShift: Shift = {
  id: 'shift-demo-1',
  userId: 'worker-1',
  status: 'scheduled'
};

export default function WorkerScreen() {
  const [shift, setShift] = useState<Shift>(demoShift);
  const [status, setStatus] = useState('Tracking is off');

  async function handleStartShift() {
    await requestShiftTrackingConsent();
    const tracking = await startShiftTracking({ ...shift, status: 'active', startedAt: new Date().toISOString() });
    setShift((current) => ({ ...current, status: 'active', startedAt: new Date().toISOString(), trackingMode: 'background' }));
    setStatus(tracking.lastSyncLabel);
  }

  async function handleEndShift() {
    const tracking = await stopShiftTracking();
    setShift((current) => ({ ...current, status: 'ended', endedAt: new Date().toISOString() }));
    setStatus(tracking.lastSyncLabel);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a', padding: 20, gap: 18 }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: '700' }}>Worker shift console</Text>
      <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: '#e5e7eb' }}>Role: worker</Text>
        <Text style={{ color: '#e5e7eb' }}>Shift status: {shift.status}</Text>
        <Text style={{ color: '#e5e7eb' }}>Tracking status: {status}</Text>
        <Text style={{ color: '#93c5fd' }}>
          Tracking only runs during active shifts and should be clearly disclosed to workers.
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <Pressable onPress={handleStartShift} style={{ backgroundColor: '#0ea5e9', padding: 16, borderRadius: 12 }}>
          <Text style={{ color: '#082f49', fontWeight: '700', textAlign: 'center' }}>Start shift and enable tracking</Text>
        </Pressable>
        <Pressable onPress={handleEndShift} style={{ backgroundColor: '#fca5a5', padding: 16, borderRadius: 12 }}>
          <Text style={{ color: '#7f1d1d', fontWeight: '700', textAlign: 'center' }}>End shift and stop tracking</Text>
        </Pressable>
      </View>
      <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: 'white', fontWeight: '700' }}>Consent summary</Text>
        <Text style={{ color: '#d1d5db' }}>- Collected during active shift only</Text>
        <Text style={{ color: '#d1d5db' }}>- Visible to authorized admins</Text>
        <Text style={{ color: '#d1d5db' }}>- Stops when shift ends</Text>
      </View>
    </SafeAreaView>
  );
}
