import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { MapPin, Minus, Plus, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Coordinates, createOrder, getMenuByShopId, MenuItemDto, OrderDto, RestaurantDto } from '../lib/api';

interface Props {
  restaurant: RestaurantDto | null;
  onClose: () => void;
  userLocation: Coordinates | null;
}


function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Raggio della terra in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distanza in km
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export default function RestaurantSheet({ restaurant, onClose, userLocation }: Props) {
  const { user } = useAuth();
  const bottomSheetRef = React.useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['25%', '50%', '90%'], []);

  const [menuItems, setMenuItems] = useState<MenuItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<MenuItemDto[]>([]);
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);


  const [deliveryAddressStr, setDeliveryAddressStr] = useState("");
  const [isAddressLoading, setIsAddressLoading] = useState(false);


  useEffect(() => {
    if (restaurant?.id) {
      loadMenu(restaurant.id);
      setCart([]);
      setIsCheckoutMode(false);
      bottomSheetRef.current?.snapToIndex(1);
    }
  }, [restaurant]);

  useEffect(() => {
    const fetchAddress = async () => {
      if (!userLocation) return;
      setIsAddressLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLocation.latitude}&lon=${userLocation.longitude}`,
          {
            headers: { 'User-Agent': 'FastGoUserApp/1.0' }
          }
        );
        
        if (!response.ok) throw new Error("Errore API Nominatim");
        
        const data = await response.json();
        if (data && data.address) {
          const street = data.address.road || data.address.pedestrian || "";
          const city = data.address.city || data.address.town || data.address.village || "";
          setDeliveryAddressStr(`${street}, ${city}`); 
        }
      } catch (error) {
        console.error("Errore reverse geocoding", error);
        setDeliveryAddressStr("Indirizzo non rilevato, inserisci manualmente.");
      } finally {
        setIsAddressLoading(false);
      }
    };

    if (restaurant) {
        fetchAddress();
    }
  }, [restaurant, userLocation]);

  const loadMenu = async (id: string) => {
    setLoading(true);
    const data = await getMenuByShopId(id);
    setMenuItems(data?.items || []);
    setLoading(false);
  };

  const addToCart = (item: MenuItemDto) => setCart([...cart, item]);
  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const total = cart.reduce((sum, item) => sum + item.price, 0);


  const handleCreateOrder = async () => {
    if (!user || !restaurant || !userLocation) return;


    if (!deliveryAddressStr || deliveryAddressStr.length < 3) {
        Alert.alert("Indirizzo mancante", "Per favore inserisci un indirizzo valido.");
        return;
    }

    setPlacingOrder(true);
    Keyboard.dismiss();

    try {
        
        const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(deliveryAddressStr)}`,
            {
                headers: { 'User-Agent': 'FastGoUserApp/1.0' }
            }
        );
        
        const geoData = await geoResponse.json();

        //  Indirizzo Trovato , chekc distanza
        if (geoData && geoData.length > 0) {
            const inputLat = parseFloat(geoData[0].lat);
            const inputLon = parseFloat(geoData[0].lon);

            const distance = getDistanceFromLatLonInKm(
                userLocation.latitude, userLocation.longitude,
                inputLat, inputLon
            );

            console.log(`Distanza calcolata: ${distance.toFixed(3)} km`);

            // SOGLIA: 1 KM
            const MAX_DISTANCE_KM = 5.0; 

            if (distance > MAX_DISTANCE_KM) {
                setPlacingOrder(false); 
                Alert.alert(
                    "Indirizzo troppo lontano",
                    `Hai inserito "${deliveryAddressStr}" che dista ${distance.toFixed(1)}km dal marker sulla mappa.`,
                    [
                        { text: "Indietro", style: "cancel" },
                       
                    ]
                );
                return; 
            }

            
            submitOrder();
        } 
        // Indirizzo non Trovato 
        else {
            setPlacingOrder(false);
            Alert.alert(
                "Indirizzo non riconosciuto",
                "Non riusciamo a verificare questo indirizzo sulla mappa. Controlla di aver scritto Città e Via.",
                [
                    { text: "Correggi", style: "cancel" },
                    { text: "Usa comunque", onPress: () => submitOrder() }
                ]
            );
        }

    } catch (e) {
        setPlacingOrder(false);
        console.error("Errore verifica distanza", e);
        Alert.alert("Errore Connessione", "Impossibile verificare l'indirizzo.");
    }
  };


  const submitOrder = async () => {
    if (!user || !restaurant) return;
    

    setPlacingOrder(true);

    const addressParts = deliveryAddressStr.split(',');
    const street = addressParts[0].trim();
    const city = addressParts.length > 1 ? addressParts[1].trim() : "Lecce";

    const orderPayload: OrderDto = {
        id: "",
        clientId: user.id,
        usernameClient: user.name,
        shopId: restaurant.id || "",
        shopName: restaurant.restaurantName,
        shopAddress: {
             street: restaurant.restaurantAddress,
             city: restaurant.restaurantCity,
             zipCode: restaurant.restaurantPostalCode || "00000"
        },
        deliveryAddress: {
            street: street,
            city: city,
            zipCode: "00000" 
        },
        orderDetails: cart.map(i => ({
            productName: i.name,
            quantity: 1,
            priceProduct: i.price
        })),
        orderDate: new Date().toISOString(),
        orderStatus: "PENDING",
        totalPrice: total
    };

    const success = await createOrder(orderPayload);
    setPlacingOrder(false);

    if (success) {
        Alert.alert("Ordine Inviato!", "Il ristorante ha ricevuto il tuo ordine.");
        onClose();
    } else {
        Alert.alert("Errore", "Impossibile inviare l'ordine al server.");
    }
  };

  if (!restaurant) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={1} 
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      onClose={onClose}
      keyboardBehavior="extend"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: 'white', borderRadius: 24, shadowColor: "#000", elevation: 10 }}
    >
      <View className="flex-1 px-4">
        {/* HEADER */}
        <View className="flex-row items-center border-b border-gray-100 pb-4 mb-2">
           <View className="w-16 h-16 bg-gray-200 rounded-lg mr-4 overflow-hidden">
              <Image 
                source={{ uri: restaurant.pictureUrl || "https://placehold.co/100x100/png?text=Rest" }} 
                className="w-full h-full"
              />
           </View>
           <View className="flex-1">
              <Text className="text-xl font-bold text-slate-800">{restaurant.restaurantName}</Text>
              <Text className="text-slate-500 text-sm">{restaurant.restaurantCity}</Text>
           </View>
           <TouchableOpacity onPress={onClose} className="bg-gray-100 p-2 rounded-full">
             <X size={20} color="gray" />
           </TouchableOpacity>
        </View>

        {loading ? (
            <ActivityIndicator size="large" color="#2563EB" className="mt-10" />
        ) : isCheckoutMode ? (
            <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                <Text className="text-lg font-bold mb-4 mt-2">Dettagli Consegna</Text>
                
                <View className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
                    <View className="flex-row items-center gap-2 mb-2">
                        <MapPin size={18} color="#2563EB" />
                        <Text className="font-bold text-blue-800">Indirizzo di Consegna</Text>
                    </View>
                    
                    {isAddressLoading ? (
                        <Text className="text-slate-400 italic">Rilevamento posizione...</Text>
                    ) : (
                        <BottomSheetTextInput
                            value={deliveryAddressStr}
                            onChangeText={setDeliveryAddressStr}
                            placeholder="Inserisci via e numero civico"
                            className="text-lg text-slate-800 border-b border-blue-200 pb-2"
                        />
                    )}
                    <Text className="text-xs text-blue-500 mt-2">
                        Assicurati che l'indirizzo corrisponda al Marker sulla mappa (max 1km).
                    </Text>
                </View>

                <Text className="text-lg font-bold mb-4">Riepilogo Piatti</Text>
                {cart.map((item, idx) => (
                    <View key={idx} className="flex-row justify-between items-center py-3 border-b border-gray-50">
                        <Text className="text-slate-700 flex-1">{item.name}</Text>
                        <View className="flex-row items-center gap-4">
                            <Text className="font-bold">€ {item.price.toFixed(2)}</Text>
                            <TouchableOpacity onPress={() => removeFromCart(idx)}>
                                <Minus size={18} color="red" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </BottomSheetScrollView>
        ) : (
            <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                <Text className="text-lg font-bold mb-4 mt-2">Menu</Text>
                {menuItems.length === 0 ? (
                    <Text className="text-slate-400 text-center mt-10">Nessun piatto disponibile.</Text>
                ) : (
                    menuItems.map((item, idx) => (
                        <View key={idx} className="flex-row mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                             <View className="flex-1 pr-2">
                                <Text className="font-bold text-slate-800 text-lg">{item.name}</Text>
                                <Text className="text-slate-500 text-xs line-clamp-2 my-1">{item.description}</Text>
                                <Text className="font-bold text-blue-600 mt-2">€ {item.price.toFixed(2)}</Text>
                             </View>
                             
                             <View className="justify-between items-end">
                                <View className="w-20 h-20 bg-gray-100 rounded-lg mb-2 overflow-hidden">
                                    <Image source={{ uri: item.imageUrl || "https://placehold.co/100x100/png?text=Food" }} className="w-full h-full" resizeMode="cover" />
                                </View>
                                <TouchableOpacity 
                                    className="bg-blue-600 p-2 rounded-full"
                                    onPress={() => addToCart(item)}
                                >
                                    <Plus size={20} color="white" />
                                </TouchableOpacity>
                             </View>
                        </View>
                    ))
                )}
            </BottomSheetScrollView>
        )}

        {/* FOOTER */}
        {cart.length > 0 && (
            <View className="absolute bottom-6 left-4 right-4">
                {isCheckoutMode ? (
                     <TouchableOpacity 
                        className={`bg-green-600 p-4 rounded-xl flex-row justify-center items-center shadow-lg ${placingOrder ? 'opacity-70' : ''}`}
                        onPress={handleCreateOrder}
                        disabled={placingOrder}
                    >
                        {placingOrder ? <ActivityIndicator color="white" /> : (
                            <>
                                <Text className="text-white font-bold text-lg mr-2">Conferma Ordine</Text>
                                <Text className="text-green-100 font-bold text-lg">• € {total.toFixed(2)}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        className="bg-blue-600 p-4 rounded-xl flex-row justify-between items-center shadow-lg"
                        onPress={() => {
                            setIsCheckoutMode(true);
                            bottomSheetRef.current?.snapToIndex(2); 
                        }}
                    >
                        <View className="bg-blue-800 px-3 py-1 rounded-full">
                            <Text className="text-white font-bold">{cart.length}</Text>
                        </View>
                        <Text className="text-white font-bold text-lg">Vedi Ordine</Text>
                        <Text className="text-white font-bold text-lg">€ {total.toFixed(2)}</Text>
                    </TouchableOpacity>
                )}
            </View>
        )}
      </View>
    </BottomSheet>
  );
}