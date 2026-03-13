import { Link } from 'expo-router';
import { SafeAreaView, Text, View } from 'react-native';

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#08111f', padding: 24, gap: 18 }}>
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '700' }}>FieldOps Consent</Text>
      <Text style={{ color: '#d0d7e2', fontSize: 16 }}>
        Transparent workforce location tracking for active shifts only.
      </Text>
      <View style={{ gap: 12 }}>
        <Link href="/worker" style={{ color: '#7dd3fc', fontSize: 18 }}>Open worker app</Link>
        <Link href="/admin" style={{ color: '#7dd3fc', fontSize: 18 }}>Open admin mobile view</Link>
      </View>
    </SafeAreaView>
  );
}
