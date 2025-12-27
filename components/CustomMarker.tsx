import { Utensils } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { Marker } from 'react-native-maps';

interface Props {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title: string;
  onPress: () => void;
}

export default function CustomMarker({ coordinate, title, onPress }: Props) {
  return (
    <Marker coordinate={coordinate} onPress={onPress}>
      <View className="bg-white p-2 rounded-full border-2 border-blue-600 shadow-sm items-center justify-center w-10 h-10">
        <Utensils size={20} color="#2563EB" />
      </View>
  
      <View className="w-0 h-0 bg-transparent border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-blue-600 self-center" />
    </Marker>
  );
}