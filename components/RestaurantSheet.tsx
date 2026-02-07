import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Check, MapPin, Minus, Pencil, Plus, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Coordinates, createOrder, getMenuByShopId, MenuItemDto, OrderDto, RestaurantDto } from '../lib/api';

interface Props {
  restaurant: RestaurantDto | null;
  onClose: () => void;
  userLocation: Coordinates | null;
}

interface AddressDetails {
  street: string;
  number: string;
  city: string;
  zipCode: string;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

  // NDIRIZZO STRUTTURATO
  const [addressDetails, setAddressDetails] = useState<AddressDetails>({
    street: '',
    number: '',
    city: 'Lecce',
    zipCode: '73100'
  });
  
  // Stato per gestire la UI di modifica (form vs visualizzazione)
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isAddressLoading, setIsAddressLoading] = useState(false);

  useEffect(() => {
    if (restaurant?.id) {
      loadMenu(restaurant.id);
      setCart([]);
      setIsCheckoutMode(false);
      bottomSheetRef.current?.snapToIndex(1);
    }
  }, [restaurant]);

  // Reverse Geocoding: Popola i campi strutturati
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
          setAddressDetails({
            street: data.address.road || data.address.pedestrian || "",
            number: data.address.house_number || "",
            city: data.address.city || data.address.town || data.address.village || "",
            zipCode: data.address.postcode || ""
          });
        }
      } catch (error) {
        console.error("Errore reverse geocoding", error);
     
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

  // Validazione e Creazione Ordine
  const handleCreateOrder = async () => {
    if (!user || !restaurant || !userLocation) return;

    // Controllo campi vuoti
    if (!addressDetails.street || !addressDetails.city) {
        Alert.alert("Indirizzo incompleto", "Per favore inserisci almeno la via e la città.");
        setIsEditingAddress(true); // Apre il form se mancano dati
        return;
    }

    setPlacingOrder(true);
    Keyboard.dismiss();

    // stringa completa per la verifica della distanza
    const fullAddressString = `${addressDetails.street} ${addressDetails.number}, ${addressDetails.city}, ${addressDetails.zipCode}`;

    try {
        const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddressString)}`,
            {
                headers: { 'User-Agent': 'FastGoUserApp/1.0' }
            }
        );
        
        const geoData = await geoResponse.json();

        if (geoData && geoData.length > 0) {
            const inputLat = parseFloat(geoData[0].lat);
            const inputLon = parseFloat(geoData[0].lon);

            const distance = getDistanceFromLatLonInKm(
                userLocation.latitude, userLocation.longitude,
                inputLat, inputLon
            );

            console.log(`Distanza calcolata: ${distance.toFixed(3)} km`);
            const MAX_DISTANCE_KM = 5.0; 

            if (distance > MAX_DISTANCE_KM) {
                setPlacingOrder(false); 
                Alert.alert(
                    "Indirizzo troppo lontano",
                    `L'indirizzo dista ${distance.toFixed(1)}km dalla tua posizione attuale GPS. Sei sicuro?`,
                    [
                        { text: "Modifica", onPress: () => setIsEditingAddress(true) },
                        { text: "Conferma comunque", onPress: () => submitOrder() } 
                    ]
                );
                return; 
            }
            submitOrder();
        } else {
            // Indirizzo non geocodificato
            setPlacingOrder(false);
            Alert.alert(
                "Indirizzo non verificato",
                "Non riusciamo a trovare questo indirizzo preciso sulla mappa. Controlla i dati.",
                [
                    { text: "Correggi", onPress: () => setIsEditingAddress(true) },
                    { text: "Usa comunque", onPress: () => submitOrder() }
                ]
            );
        }

    } catch (e) {
        setPlacingOrder(false);
        console.error("Errore verifica distanza", e);
        Alert.alert("Errore Connessione", "Impossibile verificare l'indirizzo, riprova.");
    }
  };

  const submitOrder = async () => {
    if (!user || !restaurant) return;
    setPlacingOrder(true);

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
            street: `${addressDetails.street} ${addressDetails.number}`, 
            city: addressDetails.city,
            zipCode: addressDetails.zipCode
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
            <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 150 }}>
                <Text className="text-lg font-bold mb-4 mt-2">Dettagli Consegna</Text>
                
                {/* BLOCCO INDIRIZZO */}
                <View className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
                    <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center gap-2">
                            <MapPin size={18} color="#2563EB" />
                            <Text className="font-bold text-blue-800">Indirizzo di Consegna</Text>
                        </View>
                        {/* Tasto Modifica / Salva */}
                        {!isAddressLoading && (
                            <TouchableOpacity 
                                onPress={() => setIsEditingAddress(!isEditingAddress)}
                                className="flex-row items-center gap-1 bg-white px-2 py-1 rounded-md border border-blue-200"
                            >
                                {isEditingAddress ? (
                                    <>
                                        <Check size={14} color="green" />
                                        <Text className="text-xs font-bold text-green-700">Fatto</Text>
                                    </>
                                ) : (
                                    <>
                                        <Pencil size={14} color="#2563EB" />
                                        <Text className="text-xs font-bold text-blue-700">Modifica</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                    
                    {isAddressLoading ? (
                        <Text className="text-slate-400 italic py-2">Rilevamento posizione...</Text>
                    ) : isEditingAddress ? (
                        /* FORM DI MODIFICA STRUTTURATO */
                        <View className="gap-3">
                            <View>
                                <Text className="text-xs text-slate-500 mb-1">Via / Piazza</Text>
                                <BottomSheetTextInput
                                    value={addressDetails.street}
                                    onChangeText={(t) => setAddressDetails(prev => ({...prev, street: t}))}
                                    placeholder="Es. Via Roma"
                                    className="bg-white p-2 rounded border border-blue-200 text-slate-800"
                                />
                            </View>
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Text className="text-xs text-slate-500 mb-1">N. Civico</Text>
                                    <BottomSheetTextInput
                                        value={addressDetails.number}
                                        onChangeText={(t) => setAddressDetails(prev => ({...prev, number: t}))}
                                        placeholder="10"
                                        className="bg-white p-2 rounded border border-blue-200 text-slate-800"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs text-slate-500 mb-1">CAP</Text>
                                    <BottomSheetTextInput
                                        value={addressDetails.zipCode}
                                        onChangeText={(t) => setAddressDetails(prev => ({...prev, zipCode: t}))}
                                        placeholder="73100"
                                        keyboardType="numeric"
                                        className="bg-white p-2 rounded border border-blue-200 text-slate-800"
                                    />
                                </View>
                            </View>
                            <View>
                                <Text className="text-xs text-slate-500 mb-1">Città</Text>
                                <BottomSheetTextInput
                                    value={addressDetails.city}
                                    onChangeText={(t) => setAddressDetails(prev => ({...prev, city: t}))}
                                    placeholder="Città"
                                    className="bg-white p-2 rounded border border-blue-200 text-slate-800"
                                />
                            </View>
                        </View>
                    ) : (
                        /* VISUALIZZAZIONE INDIRIZZO */
                        <View>
                             <Text className="text-lg font-bold text-slate-800">
                                {addressDetails.street} {addressDetails.number}
                             </Text>
                             <Text className="text-slate-600">
                                {addressDetails.zipCode} {addressDetails.city}
                             </Text>
                        </View>
                    )}

                    {!isEditingAddress && (
                        <Text className="text-xs text-blue-400 mt-2">
                           L'indirizzo deve trovarsi entro 5km dal marker GPS.
                        </Text>
                    )}
                </View>

                {/* RIEPILOGO PIATTI  */}
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
            // LISTA MENU 
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