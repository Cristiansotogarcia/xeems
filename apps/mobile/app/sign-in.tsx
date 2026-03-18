import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Employees sign in here. Owners use the web dashboard.');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    try {
      setLoading(true);
      setStatus('Signing in...');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      const userId = data.user?.id;
      if (!userId) {
        throw new Error('No user returned from Supabase auth.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profile?.role === 'admin') {
        setStatus('This account is owner/admin only. Use the web dashboard instead.');
        await supabase.auth.signOut();
        return;
      }

      setStatus(`Welcome ${profile?.full_name ?? 'employee'}. Loading your shift console...`);
      router.replace('/worker');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#08111f', padding: 24, gap: 16 }}>
      <Text style={{ color: 'white', fontSize: 26, fontWeight: '700' }}>Employee sign in</Text>
      <Text style={{ color: '#cbd5e1' }}>
        Mobile access is for employees on shift. Owner/admin access is intentionally separated into the web dashboard.
      </Text>
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#e2e8f0' }}>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="employee@company.com"
          placeholderTextColor="#64748b"
          style={{ backgroundColor: '#111827', color: 'white', padding: 14, borderRadius: 12 }}
        />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#e2e8f0' }}>Password</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Temporary password"
          placeholderTextColor="#64748b"
          style={{ backgroundColor: '#111827', color: 'white', padding: 14, borderRadius: 12 }}
        />
      </View>
      <Pressable onPress={handleSignIn} disabled={loading} style={{ backgroundColor: '#38bdf8', padding: 16, borderRadius: 12, opacity: loading ? 0.7 : 1 }}>
        <Text style={{ color: '#082f49', textAlign: 'center', fontWeight: '700' }}>{loading ? 'Signing in...' : 'Continue as employee'}</Text>
      </Pressable>
      <View style={{ backgroundColor: '#111827', padding: 16, borderRadius: 12, gap: 6 }}>
        <Text style={{ color: '#7dd3fc', fontWeight: '700' }}>XEEMS mobile</Text>
        <Text style={{ color: '#cbd5e1' }}>Use this app to start and end shifts, lunch breaks, and pause tracking on the company phone.</Text>
        <Text style={{ color: '#cbd5e1' }}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}
