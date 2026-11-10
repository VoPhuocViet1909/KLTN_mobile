import { Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'
import { Building2, ChartLine, History, House, Settings, type LucideIcon } from 'lucide-react-native'
import { isOrgAdmin, useAuth } from '@/auth/context'
import { NotificationProvider } from '@/notifications/NotificationProvider'
import { StatusProvider } from '@/realtime/StatusProvider'
import { colors, fonts } from '@/theme/tokens'

const icon =
  (Icon: LucideIcon) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Icon color={color as string} size={size} />

export default function TabsLayout() {
  const { user } = useAuth()
  const showOrg = isOrgAdmin(user)

  return (
    <StatusProvider>
      <NotificationProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
          tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Hôm nay', tabBarIcon: icon(House) }} />
        <Tabs.Screen name="history" options={{ title: 'Lịch sử', tabBarIcon: icon(History) }} />
        <Tabs.Screen name="stats" options={{ title: 'Thống kê', tabBarIcon: icon(ChartLine) }} />
        <Tabs.Screen
          name="org"
          options={{ title: 'Tổ chức', tabBarIcon: icon(Building2), href: showOrg ? undefined : null }}
        />
        <Tabs.Screen name="settings" options={{ title: 'Cài đặt', tabBarIcon: icon(Settings) }} />
      </Tabs>
      </NotificationProvider>
    </StatusProvider>
  )
}
