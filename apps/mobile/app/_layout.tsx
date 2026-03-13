import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { resumeShiftTrackingIfNeeded } from '../lib/location';

export default function RootLayout() {
  useEffect(() => {
    void resumeShiftTrackingIfNeeded();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
