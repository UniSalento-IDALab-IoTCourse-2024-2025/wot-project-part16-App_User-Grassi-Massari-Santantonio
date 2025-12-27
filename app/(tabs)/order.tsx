import { ChevronRight, Clock, Package, ShoppingBag, Truck } from 'lucide-react-native';
import mqtt from 'mqtt';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getMyOrders, OrderDto } from '../../lib/api';


import OrderDetailSheet from '../../components/OrderDetailSheet';

const MQTT_BROKER_WS = "ws://10.0.2.2:9001"; 

const getStatusInfo = (status: string) => {
  switch (status) {
    case "PENDING": 
      return { color: "bg-yellow-500", text: "text-yellow-700", bgLight: "bg-yellow-100", label: "In Attesa", icon: <Clock size={16} color="#A16207"/> };
    case "ACCEPTED": 
      return { color: "bg-blue-500", text: "text-blue-700", bgLight: "bg-blue-100", label: "Accettato", icon: <Package size={16} color="#1D4ED8"/> };
    case "IN_PROGRESS": 
      return { color: "bg-blue-500", text: "text-blue-700", bgLight: "bg-blue-100", label: "Accettato", icon: <Package size={16} color="#1D4ED8"/> };
    case "DELIVERING": 
      return { color: "bg-purple-500", text: "text-purple-700", bgLight: "bg-purple-100", label: "In Consegna", icon: <Truck size={16} color="#7E22CE"/> };
    case "DELIVER": 
      return { color: "bg-purple-500", text: "text-purple-700", bgLight: "bg-purple-100", label: "In Consegna", icon: <Truck size={16} color="#7E22CE"/> };
    default: 
      return { color: "bg-gray-500", text: "text-gray-700", bgLight: "bg-gray-100", label: status, icon: <Clock size={16} color="gray"/> };
  }
};

export default function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  
  // STATO PER ORDINE SELEZIONATO
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);

  const clientRef = useRef<mqtt.MqttClient | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      if (user) { 
        try {
            const data = await getMyOrders(); 
            const activeOrders = data.filter(o => 
                o.orderStatus !== 'DELIVERED' && o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'REJECTED' && o.orderStatus !== 'COMPLETED'
            );
            const sorted = activeOrders.sort((a, b) => 
                new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
            );
            setOrders(sorted);
        } catch (err) { console.error(err); }
      }
      setLoading(false);
    }
    fetchOrders();
  }, [user]);

  useEffect(() => {
    if (loading || orders.length === 0) return;
    if (clientRef.current) return; 

    const clientIdMqtt = `app_user_${user?.id}_${Date.now()}`;
    const client = mqtt.connect(MQTT_BROKER_WS, { clientId: clientIdMqtt, clean: true, reconnectPeriod: 5000 });
    clientRef.current = client;

    client.on("connect", () => {
      orders.forEach(order => client.subscribe(`shop/${order.shopId}/${order.id}`, { qos: 0 }));
    });

    client.on("message", (topic, message) => {
      try {
        const updatedOrder = JSON.parse(message.toString()) as OrderDto;

        if (['DELIVERED', 'CANCELLED', 'REJECTED', 'COMPLETED'].includes(updatedOrder.orderStatus)) {
             Alert.alert("Ordine Concluso", `L'ordine è stato ${updatedOrder.orderStatus.toLowerCase()}.`);
             setOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
             setSelectedOrder(null); 
             return;
        }

        // Aggiorna lista
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        
  
        if (selectedOrder && selectedOrder.id === updatedOrder.id) {
            setSelectedOrder(updatedOrder);
        }

      } catch (e) { console.error(e); }
    });

    return () => { clientRef.current?.end(); clientRef.current = null; };
  }, [orders.length, loading, user?.id, selectedOrder]);

  if (loading) return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#2563EB"/></View>;

  return (
    <View className="flex-1 bg-slate-50 pt-12 px-4">
      <Text className="text-3xl font-bold text-slate-900 mb-6">Ordini in Corso</Text>

      {orders.length === 0 ? (
        <View className="items-center justify-center mt-20 bg-white p-8 rounded-2xl shadow-sm">
            <ShoppingBag size={64} color="#CBD5E1" />
            <Text className="text-slate-500 text-lg mt-4 font-bold">Nessun ordine attivo</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {orders.map((order) => {
            const statusInfo = getStatusInfo(order.orderStatus);
            
            return (
                // TOUCHABLE OPACITY PER APRIRE IL SHEET
                <TouchableOpacity 
                    key={order.id} 
                    activeOpacity={0.9}
                    onPress={() => setSelectedOrder(order)}
                >
                    <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-100">
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
                                    <Text className="text-slate-600 text-sm">
                                        <Text className="font-bold">{item.quantity}x</Text> {item.productName}
                                    </Text>
                                    <Text className="text-slate-500 text-sm font-mono">€ {item.priceProduct.toFixed(2)}</Text>
                                </View>
                            ))}
                            {order.orderDetails.length > 2 && (
                                <Text className="text-xs text-slate-400 mt-1">e altri {order.orderDetails.length - 2} piatti...</Text>
                            )}
                        </View>

                        <View className="flex-row justify-between items-center border-t border-slate-100 pt-3">
                             <View className="flex-row items-center">
                                <Text className="text-blue-600 font-bold mr-1">Dettagli & Tracking</Text>
                                <ChevronRight size={16} color="#2563EB" />
                             </View>
                             <Text className="text-xl font-bold text-slate-800">€ {order.totalPrice.toFixed(2)}</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
          })}
          <View className="h-20" /> 
        </ScrollView>
      )}

      {/* COMPONENTE SHEET IN FONDO */}
      {selectedOrder && (
        <OrderDetailSheet 
            order={selectedOrder} 
            onClose={() => setSelectedOrder(null)} 
        />
      )}
    </View>
  );
}