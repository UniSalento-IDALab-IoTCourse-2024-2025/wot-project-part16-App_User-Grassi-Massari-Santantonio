import * as Location from 'expo-location';
import { MapPin, Navigation } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { findNearbyRestaurants, type RestaurantDto } from '../../lib/api';

import CustomMarker from '../../components/CustomMarker';
import DeliveryMarker from '../../components/DeliveryMarker';
import RestaurantSheet from '../../components/RestaurantSheet';

//Lecce
const DEFAULT_REGION = {
  latitude: 40.35344,
  longitude: 18.17197,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loading, setLoading] = useState(false);
  

  const [deliveryLocation, setDeliveryLocation] = useState<{latitude: number, longitude: number} | null>(null);
  
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantDto | null>(null);
  const mapRef = useRef<MapView>(null);


 useEffect(() => {
    (async () => {
      
      setDeliveryLocation({ latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude });

      try {
        // permessi
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          
          searchRestaurants(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude);
          return;
        }

        
        let location = await Location.getCurrentPositionAsync({});
        
        const userReg = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

      
        setRegion(userReg);
        setDeliveryLocation({ latitude: userReg.latitude, longitude: userReg.longitude });
        mapRef.current?.animateToRegion(userReg, 1000);
        searchRestaurants(userReg.latitude, userReg.longitude);

      } catch (error) {
        console.log("GPS Spento o non disponibile:", error);
        // Default lecce
        searchRestaurants(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude);
        Alert.alert("GPS Spento", "Attiva la posizione per vedere i ristoranti vicino a te, oppure sposta la casa sulla mappa.");
      }
    })();
  }, []);

  const searchRestaurants = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const data = await findNearbyRestaurants({
        latitude: lat.toString(),
        longitude: lng.toString(),
        rangeInKm: "100"
      });
      setRestaurants(data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  
  const handleMapPress = (e: any) => {
  
    const coords = e.nativeEvent.coordinate;
    setDeliveryLocation(coords);
    setSelectedRestaurant(null); 
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={true} 
        showsMyLocationButton={false}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress} 
      >
        {/* Marker della Posizione di Consegna  */}
        {deliveryLocation && (
            <DeliveryMarker coordinate={deliveryLocation} />
        )}

        {/* Marker dei Ristoranti */}
        {restaurants.map((res, index) => (
            res.latitude && res.longitude ? (
              <CustomMarker
                key={index}
                coordinate={{
                  latitude: parseFloat(res.latitude),
                  longitude: parseFloat(res.longitude),
                }}
                title={res.restaurantName}
                onPress={() => setSelectedRestaurant(res)}
              />
            ) : null
        ))}
      </MapView>

      {/* --- OVERLAYS --- */}
      <View style={styles.searchButtonContainer}>
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => searchRestaurants(region.latitude, region.longitude)}
          disabled={loading}
        >
           {loading ? <ActivityIndicator color="white" /> : (
               <>
                 <MapPin size={18} color="#fff" />
                 <Text style={styles.searchButtonText}>Cerca in questa zona</Text>
               </>
           )}
        </TouchableOpacity>
      </View>

      {/* Tasto per tornare al Marker Casa */}
      <TouchableOpacity 
        style={styles.myLocationButton}
        onPress={() => {
            if (deliveryLocation) {
                mapRef.current?.animateCamera({ center: deliveryLocation, zoom: 15 }, { duration: 500 });
            }
        }}
      >
        <Navigation size={24} color="#2563EB" />
      </TouchableOpacity>
      

      {!selectedRestaurant && (
        <View style={styles.infoBadge}>
            <Text style={styles.infoText}>Tocca sulla mappa per impostare la consegna</Text>
        </View>
      )}

      {/* --- BOTTOM SHEET --- */}
      {selectedRestaurant && (
        <RestaurantSheet 
            restaurant={selectedRestaurant} 
            onClose={() => setSelectedRestaurant(null)}
            userLocation={deliveryLocation} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  searchButtonContainer: { position: 'absolute', top: 50, alignSelf: 'center', zIndex: 0 },
  searchButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    elevation: 5,
    gap: 8,
  },
  searchButtonText: { color: 'white', fontWeight: 'bold' },
  myLocationButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: 'white',
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    elevation: 5,
  },
  infoBadge: {
    position: 'absolute',
    bottom: 35,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 15,
    elevation: 2,
  },
  infoText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
  }
});