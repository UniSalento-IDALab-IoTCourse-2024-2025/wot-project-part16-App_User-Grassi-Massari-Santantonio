import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, X } from 'lucide-react-native';
import mqtt from 'mqtt';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { OrderDto } from '../lib/api';
import CustomMarker from './CustomMarker';
import DeliveryMarker from './DeliveryMarker';

interface Props {
    order: OrderDto | null;
    onClose: () => void;
}

interface Coords {
    latitude: number;
    longitude: number;
}

const getStatusLevel = (status: string | undefined) => {
    switch (status) {
        case 'PENDING':
            return 0;
        case 'ACCEPTED':
        case 'IN_PROGRESS':
            return 1;
        case 'DELIVER':      // Rider sta andando al ristorante
        case 'DELIVERING':   // Rider sta andando dal cliente
            return 2;
        case 'DELIVERED':
        case 'COMPLETED':
            return 3;
        case 'CANCELLED':    // Gestione opzionale cancellati
        case 'REJECTED':
            return -1;
        default:
            return 0;
    }
};

const MQTT_BROKER_URL = 'ws://10.0.2.2:9001';

export default function OrderDetailSheet({ order, onClose }: Props) {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const mapRef = useRef<MapView>(null);
    const snapPoints = useMemo(() => ['50%', '90%'], []);

    const [shopCoords, setShopCoords] = useState<Coords | null>(null);
    const [deliveryCoords, setDeliveryCoords] = useState<Coords | null>(null);


    const [riderRealtimePos, setRiderRealtimePos] = useState<Coords | null>(null);
    const [loadingMap, setLoadingMap] = useState(true);





    const geocodeAddress = async (street: string, city: string): Promise<Coords | null> => {
        try {
            const query = `${street}, ${city}`;
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                headers: { 'User-Agent': 'FastGoUserApp/1.0' }
            });
            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    latitude: parseFloat(data[0].lat),
                    longitude: parseFloat(data[0].lon)
                };
            }
            return null;
        } catch (error) {
            console.error("Errore geocoding:", error);
            return null;
        }
    };


    useEffect(() => {
        if (order?.id) {
            bottomSheetRef.current?.snapToIndex(0);
            setLoadingMap(true);
            // Reset rider position quando cambia ordine
            setRiderRealtimePos(null);

            const fetchCoords = async () => {
                const shopPos = await geocodeAddress(order.shopAddress.street, order.shopAddress.city);
                const deliveryPos = await geocodeAddress(order.deliveryAddress.street, order.deliveryAddress.city);

                setShopCoords(shopPos);
                setDeliveryCoords(deliveryPos);
                setLoadingMap(false);
            };

            fetchCoords();
        }
    }, [order?.id]);


    useEffect(() => {
        if (!order) return;

        console.log(`[CLIENT MQTT] Connessione a ${MQTT_BROKER_URL}...`);

        const client = mqtt.connect(MQTT_BROKER_URL, {
            clientId: `user_app_${Math.random().toString(16).substr(2, 8)}`,
            keepalive: 60,
        });

        client.on('connect', () => {
            console.log("[CLIENT MQTT] Connesso!");

            const topic = `rider/position/${order.shopId}/${order.id}`;

            client.subscribe(topic, (err) => {
                if (!err) {
                    console.log(`[CLIENT MQTT] Sottoscritto a: ${topic}`);
                } else {
                    console.error("[CLIENT MQTT] Errore sottoscrizione:", err);
                }
            });
        });

        client.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());
                console.log("[CLIENT MQTT] Posizione ricevuta:", payload.latitude, payload.longitude);


                setRiderRealtimePos({
                    latitude: payload.latitude,
                    longitude: payload.longitude
                });

            } catch (e) {
                console.error("Errore parsing messaggio MQTT", e);
            }
        });

        client.on('error', (err) => console.warn("[CLIENT MQTT] Errore:", err));


        return () => {
            if (client) {
                client.end();
                console.log("[CLIENT MQTT] Disconnesso");
            }
        };
    }, [order?.id]);



    useEffect(() => {
        if (!loadingMap && shopCoords && deliveryCoords && mapRef.current) {
            const coordsToFit = [shopCoords, deliveryCoords];

            if (riderRealtimePos) coordsToFit.push(riderRealtimePos);

            setTimeout(() => {
                mapRef.current?.fitToCoordinates(coordsToFit, {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                });
            }, 1000);
        }
    }, [loadingMap, shopCoords, deliveryCoords, riderRealtimePos]);

    if (!order) return null;
    const currentLevel = getStatusLevel(order.orderStatus);

    // Determina quali punti collegare con la linea
    const getPolylineCoords = () => {
        if (!shopCoords || !deliveryCoords) return [];


        if (riderRealtimePos) {
            return [shopCoords, riderRealtimePos, deliveryCoords];
        }

        return [shopCoords, deliveryCoords];
    };

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            enablePanDownToClose={true}
            onClose={onClose}
            backgroundStyle={{ backgroundColor: 'white', borderRadius: 24, shadowColor: "#000", elevation: 10 }}
        >
            <View className="flex-1">
                {/* HEADER */}
                <View className="px-4 pb-4 border-b border-gray-100 flex-row justify-between items-center">
                    <View>
                        <Text className="text-xl font-bold text-slate-800">{order.shopName}</Text>
                        <Text className="text-xs text-slate-400">Ordine #{order.id.slice(0, 8)}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} className="bg-gray-100 p-2 rounded-full">
                        <X size={20} color="gray" />
                    </TouchableOpacity>
                </View>

                <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 50 }}>

                    {/* MAPPA DINAMICA */}
                    <View className="h-64 w-full bg-gray-100 mb-6 justify-center items-center">
                        {loadingMap ? (
                            <View className="items-center">
                                <ActivityIndicator size="small" color="#2563EB" />
                                <Text className="text-xs text-slate-400 mt-2">Caricamento mappa...</Text>
                            </View>
                        ) : shopCoords && deliveryCoords ? (
                            <MapView
                                ref={mapRef}
                                provider={PROVIDER_GOOGLE}
                                style={{ width: '100%', height: '100%' }}
                                initialRegion={{
                                    latitude: shopCoords.latitude,
                                    longitude: shopCoords.longitude,
                                    latitudeDelta: 0.05,
                                    longitudeDelta: 0.05,
                                }}
                                scrollEnabled={true}
                                zoomEnabled={true}
                            >
                                {/* Ristorante */}
                                <CustomMarker coordinate={shopCoords} title={order.shopName} onPress={() => { }} />

                                {/* Casa */}
                                <DeliveryMarker coordinate={deliveryCoords} />

                                {/* RIDER  */}
                                {riderRealtimePos && (
                                    <Marker coordinate={riderRealtimePos} title="Il tuo Rider">
                                        <View className="bg-white p-2 rounded-full border-2 border-purple-600 shadow-md">
                                            <Bike size={20} color="#7E22CE" />
                                        </View>
                                    </Marker>
                                )}

                                {/* Linea percorso */}
                                <Polyline
                                    coordinates={getPolylineCoords()}
                                    strokeColor="#7E22CE"
                                    strokeWidth={3}
                                    lineDashPattern={riderRealtimePos ? [] : [5, 5]}
                                />
                            </MapView>
                        ) : (
                            <Text className="text-slate-400">Impossibile caricare la mappa.</Text>
                        )}

                        {/* Overlay Info Rider */}
                        {(order.orderStatus === 'DELIVERING' && riderRealtimePos) && (
                            <View className="absolute bottom-4 left-4 right-4 bg-white p-3 rounded-xl shadow-md flex-row items-center gap-3">
                                <View className="bg-purple-100 p-2 rounded-full">
                                    <Bike size={20} color="#7E22CE" />
                                </View>
                                <View>
                                    <Text className="font-bold text-slate-800">Rider in movimento</Text>
                                    <Text className="text-xs text-slate-500">Segui la consegna in tempo reale</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* TIMELINE STATO */}
                    <View className="px-6 mb-8">
                        <Text className="font-bold text-lg mb-4 text-slate-800">Stato Ordine</Text>


                        <StatusStep
                            title="Ordine Inviato"
                            desc="In attesa di conferma"
                            icon={<Clock size={16} color="white" />}
                            active={currentLevel >= 0}
                            isLast={false}
                            color="bg-yellow-500"
                        />


                        <StatusStep
                            title="Preparazione"
                            desc="Il ristorante sta cucinando"
                            icon={<ChefHat size={16} color="white" />}
                            active={currentLevel >= 1}
                            isLast={false}
                            color="bg-blue-500"
                        />


                        <StatusStep
                            title="In Consegna"
                            desc="Il rider ha ritirato l'ordine"
                            icon={<Bike size={16} color="white" />}
                            active={currentLevel >= 2}
                            isLast={false}
                            color="bg-purple-500"
                        />


                        <StatusStep
                            title="Consegnato"
                            desc="Buon appetito!"
                            icon={<CheckCircle2 size={16} color="white" />}
                            active={currentLevel >= 3}
                            isLast={true}
                            color="bg-green-500"
                        />
                    </View>

                    {/* LISTA PIATTI */}
                    <View className="px-6 pb-10">
                        <Text className="font-bold text-lg mb-4 text-slate-800">Riepilogo</Text>
                        {order.orderDetails.map((item, idx) => (
                            <View key={idx} className="flex-row justify-between py-3 border-b border-gray-100">
                                <View className="flex-row gap-3 items-center">
                                    <Text className="font-bold text-slate-700 bg-gray-100 px-2 py-1 rounded text-xs">{item.quantity}x</Text>
                                    <Text className="text-slate-700">{item.productName}</Text>
                                </View>
                                <Text className="font-bold text-slate-700">€ {item.priceProduct.toFixed(2)}</Text>
                            </View>
                        ))}

                        <View className="flex-row justify-between mt-4 pt-4 border-t border-gray-200">
                            <Text className="font-bold text-xl text-slate-800">Totale</Text>
                            <Text className="font-bold text-xl text-blue-600">€ {order.totalPrice.toFixed(2)}</Text>
                        </View>

                        <View className="flex-row items-center gap-2 mt-6 bg-slate-50 p-4 rounded-xl">
                            <MapPin size={20} color="#64748B" />
                            <View>
                                <Text className="font-bold text-slate-700">Indirizzo Consegna</Text>
                                <Text className="text-slate-500">{order.deliveryAddress.street}, {order.deliveryAddress.city}</Text>
                            </View>
                        </View>
                    </View>

                </BottomSheetScrollView>
            </View>
        </BottomSheet>
    );
}

function StatusStep({ title, desc, icon, active, isLast, color }: any) {
    return (
        <View className="flex-row h-16">
            <View className="items-center mr-4">
                <View className={`w-8 h-8 rounded-full items-center justify-center border-2 ${active ? `${color} border-transparent` : 'bg-white border-gray-300'}`}>
                    {active && icon}
                </View>
                {!isLast && (
                    <View className={`w-0.5 flex-1 ${active ? color : 'bg-gray-200'} my-1`} />
                )}
            </View>
            <View>
                <Text className={`font-bold ${active ? 'text-slate-800' : 'text-gray-400'}`}>{title}</Text>
                <Text className="text-xs text-gray-400">{desc}</Text>
            </View>
        </View>
    )
}