import { useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView, Text, TextInput, Pressable, View } from 'react-native';

export default function SignInScreen() {
  const [email, setEmail] = useState('worker@example.com');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#08111f', padding: 24, gap: 16 }}>
      <Text style={{ color: 'white', fontSize: 26, fontWeight: '700' }}>Sign in</Text>
      <Text style={{ color: '#cbd5e1' }}>Use Supabase email/password or magic link in the production integration.</Text>
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#e2e8f0' }}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} style={{ backgroundColor: '#111827', color: 'white', padding: 14, borderRadius: 12 }} />
      </View>
      <Pressable onPress={() => router.push('/worker')} style={{ backgroundColor: '#38bdf8', padding: 16, borderRadius: 12 }}>
        <Text style={{ color: '#082f49', textAlign: 'center', fontWeight: '700' }}>Continue as worker demo</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/admin')} style={{ backgroundColor: '#c4b5fd', padding: 16, borderRadius: 12 }}>
        <Text style={{ color: '#2e1065', textAlign: 'center', fontWeight: '700' }}>Continue as admin demo</Text>
      </Pressable>
    </SafeAreaView>
  );
}
