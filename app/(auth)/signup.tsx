import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { registerUser } from '../../lib/api';

export default function SignupScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '', lastName: '', username: '', email: '', password: '', confirmPassword: ''
  });

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSignup = async () => {
    if (formData.password !== formData.confirmPassword) {
      Alert.alert("Errore", "Le password non coincidono");
      return;
    }

    const payload = {
      name: formData.name,
      lastName: formData.lastName,
      username: formData.username,
      email: formData.email,
      password: formData.password,
      role: 'USER',
      pictureUrl: '' 
    };

    const success = await registerUser(payload);
    if (success) {
      Alert.alert("Successo", "Registrazione completata! Ora puoi accedere.");
      router.back(); // Torna al login
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 24, justifyContent: 'center', minHeight: '100%' }}>
      <View className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <Text className="text-2xl font-bold text-slate-800 text-center mb-6">Crea Account</Text>

        <View className="space-y-3">
          <TextInput className="input-field" placeholder="Nome" value={formData.name} onChangeText={t => handleChange('name', t)} />
          <TextInput className="input-field" placeholder="Cognome" value={formData.lastName} onChangeText={t => handleChange('lastName', t)} />
          <TextInput className="input-field" placeholder="Username" value={formData.username} autoCapitalize="none" onChangeText={t => handleChange('username', t)} />
          <TextInput className="input-field" placeholder="Email" value={formData.email} autoCapitalize="none" keyboardType="email-address" onChangeText={t => handleChange('email', t)} />
          <TextInput className="input-field" placeholder="Password" value={formData.password} secureTextEntry onChangeText={t => handleChange('password', t)} />
          <TextInput className="input-field" placeholder="Conferma Password" value={formData.confirmPassword} secureTextEntry onChangeText={t => handleChange('confirmPassword', t)} />
          
          <Pressable className="bg-green-600 rounded-lg p-4 mt-4 items-center" onPress={handleSignup}>
            <Text className="text-white font-bold text-lg">Registrati</Text>
          </Pressable>

          <Pressable className="items-center mt-4" onPress={() => router.back()}>
            <Text className="text-slate-500">Hai già un account? Accedi</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = "w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 mb-2"; 
