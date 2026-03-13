import { SafeAreaView, Text, View } from 'react-native';

const activeWorkers = [
  { name: 'Maya', status: 'On shift', lastSeen: '2 min ago', site: 'Warehouse A' },
  { name: 'Luis', status: 'Traveling', lastSeen: '1 min ago', site: 'Site 14' }
];

const recentEvents = [
  'Maya entered Warehouse A geofence',
  'Luis started shift at 08:58',
  'Nina ended shift at 11:42'
];

export default function AdminScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617', padding: 20, gap: 16 }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: '700' }}>Admin operations view</Text>
      <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: 'white', fontWeight: '700' }}>Active workers</Text>
        {activeWorkers.map((worker) => (
          <Text key={worker.name} style={{ color: '#d1d5db' }}>
            {worker.name} — {worker.status} — {worker.site} — {worker.lastSeen}
          </Text>
        ))}
      </View>
      <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: 'white', fontWeight: '700' }}>Recent geofence / shift events</Text>
        {recentEvents.map((event) => (
          <Text key={event} style={{ color: '#d1d5db' }}>{event}</Text>
        ))}
      </View>
    </SafeAreaView>
  );
}
