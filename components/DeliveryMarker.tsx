import { Home } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { Marker } from 'react-native-maps';

interface Props {
  coordinate: {
    latitude: number;
    longitude: number;
  };
}

export default function DeliveryMarker({ coordinate }: Props) {
  return (
    <Marker coordinate={coordinate}>
      <View className="bg-blue-600 p-2 rounded-full border-2 border-white shadow-md items-center justify-center w-10 h-10">
        <Home size={20} color="white" />
      </View>
      
      <View className="w-0 h-0 bg-transparent border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-blue-600 self-center" />
    </Marker>
  );
}