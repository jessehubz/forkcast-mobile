import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import '../global.css';

import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const routeByRole = async (userId: string) => {
      try {
        const { data: profile } = await supabase
          .from('Profile')
          .select('role')
          .eq('id', userId)
          .single();
        router.replace(profile?.role === 'owner' ? '/(owner)/dashboard' : '/(diner)/');
      } catch {
        router.replace('/(diner)/');
      }
    };

    const bootstrap = async () => {
      try {
        // getSession() reads AsyncStorage — fast even offline.
        // If network is down, the 12s fetch timeout in supabase.ts ensures
        // subsequent profile fetches fail fast rather than hanging.
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          router.replace('/login');
          return;
        }
        await routeByRole(session.user.id);
      } catch {
        // Any network error or timeout → send to login, never hang
        router.replace('/login');
      }
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.replace('/login');
          return;
        }
        if (event === 'SIGNED_IN' && session) {
          await routeByRole(session.user.id);
        }
      }
    );

    return () => { subscription.unsubscribe(); };
  }, []);

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
