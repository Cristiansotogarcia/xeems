import { SafeAreaView, Text, View } from 'react-native';

export default function AdminScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f8fb', padding: 20, gap: 16 }}>
      <Text style={{ color: '#10233d', fontSize: 24, fontWeight: '700' }}>Owner/admin access moved to web</Text>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: '#d6e2ec' }}>
        <Text style={{ color: '#4b5f75' }}>
          The mobile app is now employee-only. Owners/admins should use the web dashboard so role separation stays clear.
        </Text>
        <Text style={{ color: '#355372' }}>
          This keeps active-shift GPS tracking scoped to employees while giving owners a dedicated operations console.
        </Text>
      </View>
    </SafeAreaView>
  );
}
