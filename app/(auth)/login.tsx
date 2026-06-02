import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { D } from '@/constants/theme';
import { supabase } from '@/lib/supabase';


export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) { setError(signInError.message); return; }
      if (!data.user) { setError('Sign in failed. Please try again.'); return; }

      const { data: profile } = await supabase
        .from('Profile').select('role').eq('id', data.user.id).single();

      if (profile?.role === 'owner') {
        router.replace('/(owner)/dashboard');
      } else {
        router.replace('/(diner)/');
      }
    } catch (err: any) {
      setError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-d-bg">
      {/* Atmospheric gradient background */}
      <LinearGradient
        colors={["transparent", "rgba(10,52,38,0.58)", "rgba(12,68,50,0.72)", "rgba(8,28,20,0.46)"]}
        locations={[0.05, 0.45, 0.68, 1.0]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        className="absolute inset-0"
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "rgba(18,95,70,0.38)", "transparent"]}
        locations={[0.0, 0.5, 1.0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="absolute top-[40%] left-0 right-0 bottom-0"
        pointerEvents="none"
      />
      <SafeAreaView className="flex-1 bg-transparent">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* ── Brand — matches "mindmate" at top-left of reference ── */}
        <View>
            <View className="pt-4 px-[24px] pl-5">
              <View/>
              <Text
                className="text-[15px] font-bold text-d-text-sub"
                style={{ letterSpacing: 1.5 }}
              >
                forkcast
              </Text>
            </View>
          </View>

        <ScrollView
          contentContainerClassName="flex-grow px-[24px] py-5 justify-center"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Headline — matches reference "Explore infinite capabilities" ── */}
          <Text
            className="text-[48px] font-bold text-d-text mt-9 mb-1"
            style={{ letterSpacing: -1.5, lineHeight: 56 }}
          >
            {"Reserve your"}
            <Text className="text-d-accent">{"\nmoments"}</Text>
            {"\ntogether"}
          </Text>

          {/* ── Form ── */}
          <View className="gap-4 mt-20 mb-9">
            {/* Email */}
            <TextInput
              className={`bg-d-surface border rounded-[14px] px-4 py-[15px] text-[15px] text-d-text ${emailFocused ? 'border-d-accent/[44%] bg-d-surface-raised' : 'border-d-border'}`}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={D.textDim}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />

            {/* Password */}
            <TextInput
              className={`bg-d-surface border rounded-[14px] px-4 py-[15px] text-[15px] text-d-text ${passwordFocused ? 'border-d-accent/[44%] bg-d-surface-raised' : 'border-d-border'}`}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={D.textDim}
              secureTextEntry
              autoComplete="password"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />

            {error ? (
              <Text className="text-[13px] text-d-danger text-center py-[2px]">{error}</Text>
            ) : null}

            {/* ── Bottom buttons — matches reference "Login" + "Register" side-by-side ── */}
            <View className="flex-row gap-3 mt-2">
              {/* Login — outlined (ghost) */}
              <TouchableOpacity
                className="flex-1 border-[1.5px] border-d-border rounded-[14px] py-4 items-center justify-center bg-d-surface"
                onPress={() => router.push('/signup' as any)}
                activeOpacity={0.8}
              >
                <Text className="text-[16px] font-semibold text-d-text">Register</Text>
              </TouchableOpacity>

              {/* Register — filled (primary) */}
              <TouchableOpacity
                className={`flex-1 rounded-[14px] py-4 items-center justify-center min-h-[52px] bg-d-text ${loading ? 'opacity-60' : ''}`}
                onPress={handleSignIn}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={D.bg} size="small" />
                ) : (
                  <Text className="text-[16px] font-bold text-d-bg">Login</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
