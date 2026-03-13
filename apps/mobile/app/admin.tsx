import { Link } from 'expo-router';
import { SafeAreaView, Text, View } from 'react-native';

export default function AdminScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617', padding: 20, gap: 16 }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: '700' }}>Owner/admin access moved to web</Text>
      <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: '#d1d5db' }}>
          The mobile app is now employee-only. Owners/admins should use the web dashboard so role separation stays clear.
        </Text>
        <Text style={{ color: '#93c5fd' }}>
          This keeps active-shift GPS tracking scoped to employees while giving owners a dedicated operations console.
        </Text>
      </View>
      <Link href="https://supabase.com/dashboard/project/gfvxqomihlolxhfigebk" style={{ color: '#c4b5fd', fontSize: 16 }}>
        Open Supabase project dashboard
      </Link>
    </SafeAreaView>
  );
}
