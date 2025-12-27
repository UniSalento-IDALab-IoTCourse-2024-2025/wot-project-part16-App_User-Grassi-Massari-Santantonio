import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { loginUser } from '../../lib/api';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) return Alert.alert("Errore", "Inserisci i dati");
    
    setLoading(true);
    const result = await loginUser({ username, password });
    setLoading(false);

    if (result.success && result.data) {
      if (result.data.role !== 'USER') {
        Alert.alert("Errore", "Accesso riservato ai clienti");
        return;
      }
      login(result.data.jwt, result.data.role);
    } else {
      Alert.alert("Errore", result.message || "Login fallito");
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-3xl font-bold text-center mb-8 text-slate-800">FastGo</Text>
      
      <TextInput 
        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4"
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      
      <TextInput 
        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6"
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable 
        className="bg-blue-600 p-4 rounded-lg items-center"
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Accedi</Text>}
      </Pressable>

      <Link href="/(auth)/signup" asChild>
        <Pressable className="mt-6 items-center">
          <Text className="text-slate-500">Non hai un account? <Text className="text-blue-600 font-bold">Registrati</Text></Text>
        </Pressable>
      </Link>
    </View>
  );
}