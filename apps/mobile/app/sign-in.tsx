import { useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
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
        .select('*')
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

      const name = profile?.full_name?.trim() || profile?.email?.trim() || 'employee';
      setStatus(`Welcome ${name}. Loading your shift console...`);
      router.replace('/worker');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f8fb', padding: 24, gap: 18 }}>
      <View style={{ alignItems: 'center', paddingTop: 8 }}>
        <Image source={require('../assets/xeems-logo.png')} style={{ width: 280, height: 88 }} resizeMode="contain" />
      </View>
      <Text style={{ color: '#10233d', fontSize: 26, fontWeight: '700' }}>Employee sign in</Text>
      <Text style={{ color: '#4b5f75' }}>
        Mobile access is for employees on shift. Owner/admin access is intentionally separated into the web dashboard.
      </Text>
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#355372' }}>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="employee@company.com"
          placeholderTextColor="#7b8da1"
          style={{ backgroundColor: '#ffffff', color: '#10233d', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#c6d5e3' }}
        />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: '#355372' }}>Password</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Temporary password"
          placeholderTextColor="#7b8da1"
          style={{ backgroundColor: '#ffffff', color: '#10233d', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#c6d5e3' }}
        />
      </View>
      <Pressable onPress={handleSignIn} disabled={loading} style={{ backgroundColor: '#1d62d1', padding: 16, borderRadius: 14, opacity: loading ? 0.7 : 1 }}>
        <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '700' }}>{loading ? 'Signing in...' : 'Continue as employee'}</Text>
      </Pressable>
      <View style={{ backgroundColor: '#ffffff', padding: 16, borderRadius: 16, gap: 6, borderWidth: 1, borderColor: '#d6e2ec' }}>
        <Text style={{ color: '#f97316', fontWeight: '700' }}>XEEMS mobile</Text>
        <Text style={{ color: '#4b5f75' }}>Use this app to start and end shifts, lunch breaks, and pause tracking on the company phone.</Text>
        <Text style={{ color: '#355372' }}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}
