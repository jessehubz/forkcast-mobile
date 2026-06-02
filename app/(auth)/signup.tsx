import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Role = 'diner' | 'owner';

export default function SignupScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('diner');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      const user = data.user;
      if (!user) {
        setError('Sign up failed. Please try again.');
        return;
      }

      const { error: profileError } = await supabase.from('Profile').insert({
        id: user.id,
        name: name.trim(),
        email: email.trim(),
        role,
      });

      if (profileError) {
        setError(profileError.message);
        return;
      }

      if (role === 'owner') {
        router.replace('/(owner)/dashboard');
      } else {
        router.replace('/(diner)/');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-d-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-[24px] py-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-8">
            <Text
              className="text-[32px] font-bold text-d-accent-mid"
              style={{ letterSpacing: 0.5 }}
            >
              Forkcast
            </Text>
            <Text className="text-[18px] font-semibold text-d-text mt-2">
              Create your account
            </Text>
          </View>

          {/* Role picker */}
          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              className={`flex-1 items-center justify-center py-5 rounded-[16px] border-[1.5px] gap-2 ${role === 'diner' ? 'border-d-accent bg-d-surface-raised' : 'border-d-border bg-d-surface'}`}
              onPress={() => setRole('diner')}
              activeOpacity={0.8}
            >
              <Text className="text-[28px]">🍽️</Text>
              <Text className={`text-[14px] font-semibold ${role === 'diner' ? 'text-d-text' : 'text-d-text-sub'}`}>
                Diner
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 items-center justify-center py-5 rounded-[16px] border-[1.5px] gap-2 ${role === 'owner' ? 'border-d-accent bg-d-surface-raised' : 'border-d-border bg-d-surface'}`}
              onPress={() => setRole('owner')}
              activeOpacity={0.8}
            >
              <Text className="text-[28px]">🏪</Text>
              <Text className={`text-[14px] font-semibold ${role === 'owner' ? 'text-d-text' : 'text-d-text-sub'}`}>
                Owner
              </Text>
            </TouchableOpacity>
          </View>

          <View className="gap-4">
            <View className="gap-[6px]">
              <Text className="text-[12px] text-d-text-sub font-medium">Full name</Text>
              <TextInput
                className={`bg-d-surface-raised border rounded-[12px] px-3 py-[14px] text-[14px] text-d-text ${nameFocused ? 'border-d-accent' : 'border-d-border'}`}
                value={name}
                onChangeText={setName}
                placeholder="Jane Doe"
                placeholderTextColor={Colors.creamDim}
                autoCapitalize="words"
                autoComplete="name"
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>

            <View className="gap-[6px]">
              <Text className="text-[12px] text-d-text-sub font-medium">Email</Text>
              <TextInput
                className={`bg-d-surface-raised border rounded-[12px] px-3 py-[14px] text-[14px] text-d-text ${emailFocused ? 'border-d-accent' : 'border-d-border'}`}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.creamDim}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            <View className="gap-[6px]">
              <Text className="text-[12px] text-d-text-sub font-medium">Password</Text>
              <TextInput
                className={`bg-d-surface-raised border rounded-[12px] px-3 py-[14px] text-[14px] text-d-text ${passwordFocused ? 'border-d-accent' : 'border-d-border'}`}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={Colors.creamDim}
                secureTextEntry
                autoComplete="new-password"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </View>

            {error ? (
              <Text className="text-[13px] text-d-danger text-center">{error}</Text>
            ) : null}

            <TouchableOpacity
              className={`bg-d-accent rounded-[12px] py-4 items-center justify-center mt-1 min-h-[52px] ${loading ? 'opacity-60' : ''}`}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text className="text-[16px] font-semibold text-white">Create account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="items-center py-2"
              onPress={() => router.push('/login')}
              activeOpacity={0.7}
            >
              <Text className="text-[14px] text-d-text-sub">
                Already have an account?{' '}
                <Text className="text-d-accent font-semibold">Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
