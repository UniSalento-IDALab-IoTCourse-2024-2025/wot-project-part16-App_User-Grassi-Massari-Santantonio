import * as Notifications from 'expo-notifications';
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clock, Package, RefreshCw, ShoppingBag, Truck, XCircle } from 'lucide-react-native';
import mqtt from 'mqtt';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import OrderDetailSheet from '../../components/OrderDetailSheet';
import { useAuth } from '../../context/AuthContext';
import { getMyOrders, OrderDto } from '../../lib/api';


//const MQTT_BROKER_WS = 'ws://10.175.177.237:9001';  // ip del computer o server
//const MQTT_BROKER_WS = 'ws://10.0.2.2:9001';// 10.0.2.2 per emulatore Android
const MQTT_BROKER_WS = 'ws://98.95.66.15:9001';

// Configurazione notifiche
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, 
    shouldShowList: true,  
  }),
});

const getStatusInfo = (status: string) => {
  switch (status) {
    case "PENDING": 
      return { color: "bg-yellow-500", text: "text-yellow-700", bgLight: "bg-yellow-100", label: "In Attesa", icon: <Clock size={16} color="#A16207"/> };
    case "ACCEPTED": 
    case "IN_PROGRESS": 
      return { color: "bg-blue-500", text: "text-blue-700", bgLight: "bg-blue-100", label: "In Preparazione", icon: <Package size={16} color="#1D4ED8"/> };
    case "DELIVERING": 
    case "DELIVER":
      return { color: "bg-purple-500", text: "text-purple-700", bgLight: "bg-purple-100", label: "In Consegna", icon: <Truck size={16} color="#7E22CE"/> };
    case "DELIVERED":
    case "COMPLETED":
      return { color: "bg-green-500", text: "text-green-700", bgLight: "bg-green-100", label: "Consegnato", icon: <CheckCircle2 size={16} color="#15803d"/> };
    case "CANCELLED":
    case "REJECTED":
      return { color: "bg-red-500", text: "text-red-700", bgLight: "bg-red-100", label: "Annullato", icon: <XCircle size={16} color="#B91C1C"/> };
    default: 
      return { color: "bg-gray-500", text: "text-gray-700", bgLight: "bg-gray-100", label: status, icon: <Clock size={16} color="gray"/> };
  }
};

const getNotificationBody = (status: string, shopName: string) => {
    switch (status) {
        case 'ACCEPTED': return `Il ristorante ${shopName} ha accettato il tuo ordine.`;
        case 'DELIVERING': return `Il tuo ordine da ${shopName} è in consegna.`;
        case 'DELIVERED': return `Il tuo ordine da ${shopName} è stato consegnato. Buon appetito!`;
        case 'REJECTED': return `Purtroppo il ristorante ${shopName} ha rifiutato l'ordine.`;
        case 'CANCELLED': return `L'ordine da ${shopName} è stato annullato.`;
        default: return `Aggiornamento stato ordine da ${shopName}: ${status}`;
    }
};

export default function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const [mqttConnected, setMqttConnected] = useState(false);

  // Permessi notifica
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') await Notifications.requestPermissionsAsync();
    })();
  }, []);

  // Connessione MQTT
  useEffect(() => {
    if (clientRef.current) return; 

    const clientIdMqtt = `app_user_${user?.id}_${Math.random().toString(16).slice(2, 8)}`;
    console.log(`[DEBUG MQTT] Tentativo connessione a ${MQTT_BROKER_WS}...`);

    const client = mqtt.connect(MQTT_BROKER_WS, { 
        clientId: clientIdMqtt, 
        clean: true, 
        reconnectPeriod: 3000,
        keepalive: 45
    });
    
    clientRef.current = client;

    client.on("connect", () => {
      console.log("[DEBUG MQTT] Connesso");
      setMqttConnected(true);
    });

    client.on("close", () => {
        console.log("[DEBUG MQTT] Connessione chiusa");
        setMqttConnected(false);
    });

    client.on("error", (err) => console.log("[DEBUG MQTT] Errore:", err.message));

    client.on("message", async (topic, message) => {
      console.log(`[DEBUG MQTT] Messaggio ricevuto sul topic: ${topic}`);
      try {
        const updatedOrder = JSON.parse(message.toString()) as OrderDto;
        
        setOrders(prevOrders => {
            const oldOrder = prevOrders.find(o => o.id === updatedOrder.id);
            
            // Invio notifica su cambio stato
            if (oldOrder && oldOrder.orderStatus !== updatedOrder.orderStatus) {
                console.log(`[NOTIFICA] Cambio stato: ${oldOrder.orderStatus} -> ${updatedOrder.orderStatus}`);
                const bodyText = getNotificationBody(updatedOrder.orderStatus, updatedOrder.shopName);
                
                Notifications.scheduleNotificationAsync({
                    content: {
                        title: "Aggiornamento Ordine",
                        body: bodyText,
                        sound: true,
                    },
                    trigger: null,
                });
            }
            return prevOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
        });

        if (selectedOrder?.id === updatedOrder.id) setSelectedOrder(updatedOrder);

      } catch (e) { console.error("Errore parsing MQTT", e); }
    });

    return () => { 
        client.end(); 
        clientRef.current = null;
    };
  }, [user?.id]); 


  // Sottoscrizione ordini attivi
  useEffect(() => {
    if (!clientRef.current || !mqttConnected) {
        console.log("[DEBUG MQTT] Client non pronto per iscrizione");
        return;
    }

    if (orders.length === 0) return;

    // Filtro iscrizione solo ordini non conclusi
    const activeTopics = orders
        .filter(o => !['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.orderStatus))
        .map(o => `shop/${o.shopId}/${o.id}`);
    
    if (activeTopics.length > 0) {
        console.log(`[DEBUG MQTT] Iscrizione a ${activeTopics.length} ordini attivi`);
        clientRef.current.subscribe(activeTopics, { qos: 0 });
    } else {
        console.log("[DEBUG MQTT] Nessun ordine attivo da monitorare");
    }

  }, [orders, mqttConnected]); 


  // Caricamento dati API
  const loadOrders = async () => {
    if (user) { 
        try {
            const data = await getMyOrders(); 
            const sorted = data.sort((a, b) => 
                new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
            );
            setOrders(sorted);
        } catch (err) { console.error(err); }
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { loadOrders(); }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  // Filtri liste
  const activeOrders = orders.filter(o => !['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.orderStatus));
  const deliveredOrders = orders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.orderStatus));
  const failedOrders = orders.filter(o => ['CANCELLED', 'REJECTED'].includes(o.orderStatus));

  // Rendering card
  const renderOrderCard = (order: OrderDto) => {
    const statusInfo = getStatusInfo(order.orderStatus);
    const isCancelled = ['CANCELLED', 'REJECTED'].includes(order.orderStatus);

    return (
        <TouchableOpacity key={order.id} activeOpacity={0.9} onPress={() => setSelectedOrder(order)}>
            <View className={`bg-white rounded-2xl p-4 mb-4 shadow-sm border ${isCancelled ? 'border-red-100 opacity-80' : 'border-slate-100'}`}>
                <View className="flex-row justify-between items-start mb-3">
                    <View>
                        <Text className="text-lg font-bold text-slate-800">{order.shopName}</Text>
                        <Text className="text-xs text-slate-400">
                            {new Date(order.orderDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full flex-row items-center gap-1 ${statusInfo.bgLight}`}>
                        {statusInfo.icon}
                        <Text className={`text-xs font-bold ${statusInfo.text}`}>{statusInfo.label}</Text>
                    </View>
                </View>
                <View className="bg-slate-50 p-3 rounded-lg mb-3">
                    {order.orderDetails.slice(0, 2).map((item, idx) => (
                        <View key={idx} className="flex-row justify-between mb-1">
                            <Text className="text-slate-600 text-sm"><Text className="font-bold">{item.quantity}x</Text> {item.productName}</Text>
                            <Text className="text-slate-500 text-sm font-mono">€ {item.priceProduct.toFixed(2)}</Text>
                        </View>
                    ))}
                    {order.orderDetails.length > 2 && <Text className="text-xs text-slate-400 mt-1">e altri {order.orderDetails.length - 2} piatti...</Text>}
                </View>
                <View className="flex-row justify-between items-center border-t border-slate-100 pt-3">
                     <View className="flex-row items-center"><Text className="text-blue-600 font-bold mr-1">Dettagli</Text><ChevronRight size={16} color="#2563EB" /></View>
                     <Text className="text-xl font-bold text-slate-800">€ {order.totalPrice.toFixed(2)}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
  };

  if (loading) return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#2563EB"/></View>;

  return (
    <View className="flex-1 bg-slate-50 pt-12 px-4">
      <View className="flex-row justify-between items-center mb-6">
          <View className="flex-row items-center gap-2">
            <Text className="text-3xl font-bold text-slate-900">I Miei Ordini</Text>
            <View className={`w-3 h-3 rounded-full ${mqttConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          </View>
          <TouchableOpacity onPress={onRefresh} className="bg-white p-2 rounded-full shadow-sm border border-slate-100"><RefreshCw size={20} color="#2563EB" /></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />}>
          <Text className="text-lg font-bold text-slate-700 mb-3 ml-1">In Corso ({activeOrders.length})</Text>
          {activeOrders.length === 0 ? (
            <View className="items-center justify-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <ShoppingBag size={40} color="#CBD5E1" />
                <Text className="text-slate-400 text-sm mt-2">Nessun ordine attivo al momento</Text>
            </View>
          ) : activeOrders.map(renderOrderCard)}

          {(deliveredOrders.length > 0 || failedOrders.length > 0) && (
              <View className="mt-4 mb-20">
                  <TouchableOpacity onPress={() => setShowHistory(!showHistory)} className="flex-row justify-between items-center bg-slate-200 p-3 rounded-xl mb-3">
                      <Text className="text-lg font-bold text-slate-700 ml-1">Storico</Text>
                      {showHistory ? <ChevronUp size={20} color="#475569" /> : <ChevronDown size={20} color="#475569" />}
                  </TouchableOpacity>
                  {showHistory && (
                      <View>
                          {deliveredOrders.length > 0 && (
                              <View className="mb-6">
                                  <Text className="text-sm font-bold text-green-700 mb-2 ml-1 uppercase tracking-wider">Consegnati</Text>
                                  {deliveredOrders.map(renderOrderCard)}
                              </View>
                          )}
                          {failedOrders.length > 0 && (
                              <View>
                                  <Text className="text-sm font-bold text-red-700 mb-2 ml-1 uppercase tracking-wider">Cancellati / Rifiutati</Text>
                                  {failedOrders.map(renderOrderCard)}
                              </View>
                          )}
                      </View>
                  )}
              </View>
          )}
      </ScrollView>

      {selectedOrder && <OrderDetailSheet order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </View>
  );
}