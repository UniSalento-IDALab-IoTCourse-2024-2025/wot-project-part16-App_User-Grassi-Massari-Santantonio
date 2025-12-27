import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 justify-center items-center bg-white p-6">
      <Text className="text-2xl font-bold text-slate-800 mb-2">Profilo Utente</Text>
      <Text className="text-lg text-slate-600 mb-8">Benvenuto, {user?.name}</Text>

      <Pressable 
        className="bg-red-500 px-6 py-3 rounded-full"
        onPress={logout}
      >
        <Text className="text-white font-bold">Logout</Text>
      </Pressable>
    </View>
  );
}