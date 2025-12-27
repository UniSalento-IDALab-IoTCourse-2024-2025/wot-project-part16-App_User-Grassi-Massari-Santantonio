import { Tabs } from 'expo-router';
import { Bike, Map, User } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563EB', headerShown: false }}>
      <Tabs.Screen 
        name="index" 
        options={{
          title: 'Mappa',
          tabBarIcon: ({ color }) => <Map color={color} size={24} />,
        }} 
      />
      <Tabs.Screen 
        name="order" 
        options={{
          title: 'Live Orders',
          tabBarIcon: ({ color }) => <Bike color={color} size={24} />,
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{
          title: 'Profilo',
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }} 
      />
    </Tabs>
  );
}