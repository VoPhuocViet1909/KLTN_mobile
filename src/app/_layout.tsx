import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/context'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { ApiError } from '@/lib/errors'

SplashScreen.preventAutoHideAsync()

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Không thử lại lỗi 4xx (đã rõ nguyên nhân); lỗi mạng/5xx thử thêm 1 lần.
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
      },
    },
  })
}

function Routes() {
  const { status } = useAuth()
  const [fontsLoaded, fontError] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  })
  const ready = (fontsLoaded || !!fontError) && status !== 'loading'

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <View style={{ flex: 1 }}>
      <ConnectionBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'authenticated'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="member/[userId]" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'anonymous'}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </View>
  )
}

export default function RootLayout() {
  const [queryClient] = useState(makeQueryClient)
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Routes />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
