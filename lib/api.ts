import Constants from "expo-constants";
import * as SecureStore from 'expo-secure-store';

const getBaseUrl = () => {
  if (Constants.expoConfig?.hostUri) {

    const host = Constants.expoConfig.hostUri.split(':')[0];
    //return `http://${host}`; 
    return 'http://10.0.2.2';   // android emulator
  }


  //return 'http://10.175.177.237'; // ip del computer o server
  return 'http://10.0.2.2';   // android emulator 
};
//const AUTH_API_BASE = getBaseUrl() + ":8080";
//const SHOP_API_BASE = getBaseUrl() + ":8083";
//const RIDER_API_BASE = getBaseUrl() + ":8082";

const AUTH_API_BASE = "http://" + "52.21.35.190" + ":8080";
const SHOP_API_BASE = "http://" + "18.233.248.251" + ":8080";
const RIDER_API_BASE = "http://" + "54.174.240.142" + ":8080";

const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('token');
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}` 
  };
};

export interface LoginDto {
  username: string;
  password: string;
}

export interface LoginResponse {
  jwt: string;
  role: string;
}


export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface UserCoordinatesDto {
  latitude: string;
  longitude: string;
  rangeInKm: string;
}

export interface RestaurantDto {
  id?: string;
  restaurantName: string;
  restaurantCity: string;
  restaurantAddress: string;
  restaurantPostalCode: string;
  restaurantProvince: string;
  restaurantPhoneNumber?: string;
  latitude?: string;
  longitude?: string;
  pictureUrl?:string;
}

export interface MenuItemDto {
  name: string;
  price: number;
  description: string;
  category: string;
  imageUrl: string;
}

export interface MenuDto {
  id?: string;
  shopId?: string;
  items: MenuItemDto[];
}

// Interfacce per l'Ordine
export interface AddressDto {
  street: string;
  city: string;
  zipCode: string;
}

export interface OrderDetailsDto {
  productName: string;
  quantity: number;
  priceProduct: number;
}

export interface OrderDto {
  id: string;
  clientId: string;
  usernameClient: string;
  shopId: string;
  shopName: string;
  shopAddress: AddressDto;
  deliveryAddress: AddressDto;
  orderDetails: OrderDetailsDto[];
  orderDate: string;
  orderStatus: "PENDING" | "ACCEPTED" | "DELIVERING" | "DELIVERED" | "CANCELLED" | "REJECTED" | "COMPLETED" | "IN_PROGRESS" | "DELIVER";
  totalPrice: number;
  riderId?: string;
  riderName?: string;
}



// Login
export async function loginUser(credentials: LoginDto): Promise<{ success: boolean; data?: LoginResponse; message?: string }> {
  console.log("1. Inizio funzione loginUser");
  const url = `${AUTH_API_BASE}/auth/login`;
  console.log("2. URL Target:", url);

  try {

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 secondi timeout

    console.log("3. Lancio Fetch...");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    console.log("4. Risposta ricevuta. Status:", response.status);

    const responseText = await response.text();
    console.log("Body risposta grezzo:", responseText);

    
    let resultBody: any = {};
    if (responseText) {
      try {
        resultBody = JSON.parse(responseText);
      } catch (e) {
        console.error("Non è un JSON valido");
      }
    }

    if (response.ok) {
      return { success: true, data: resultBody as LoginResponse };
    } else {
      return { success: false, message: resultBody.message || "Credenziali non valide" };
    }
  } catch (error: any) {
    console.error("!!! ERRORE CRITICO LOGIN !!!");
    console.error("Tipo errore:", error.name);
    console.error("Messaggio:", error.message);
    if (error.cause) console.error("Causa:", error.cause);
    
    return { success: false, message: `Errore rete: ${error.message}` };
  }
}

// Registrazione 
export async function registerUser(payload: any): Promise<boolean> {
  const endpoint = "/registration/client";
  
  try {
    const response = await fetch(`${AUTH_API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) return true;
    
    const errorBody = await response.json();
    console.error("Errore reg:", errorBody);
    return false;

  } catch (error) {
    console.error("Errore rete reg:", error);
    return false;
  }
}

export async function findNearbyRestaurants(coords: UserCoordinatesDto): Promise<RestaurantDto[]> {
  try {
    const response = await fetch(`${SHOP_API_BASE}/restaurants/nearby`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coords),
    });

    if (response.ok) {
      return await response.json();
    }
    console.error("Errore fetch nearby:", response.status);
    return [];
  } catch (error) {
    console.error("Errore di rete findNearbyRestaurants:", error);
    return [];
  }
}

export async function getMenuByShopId(shopId: string): Promise<MenuDto | null> {
  try {
    const response = await fetch(`${SHOP_API_BASE}/menu/by-shop/${shopId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }, 
    });

    if (response.ok) return await response.json();
    return null;
  } catch (error) {
    console.error("Errore getMenuByShopId:", error);
    return null;
  }
}


export async function createOrder(orderData: OrderDto): Promise<boolean> {
  try {
    const headers = await getAuthHeaders(); 
    
    const response = await fetch(`${SHOP_API_BASE}/order/create`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(orderData)
    });

    return response.ok;
  } catch (error) {
    console.error("Errore createOrder:", error);
    return false;
  }
}

export async function getMyOrders(): Promise<OrderDto[]> {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${SHOP_API_BASE}/order/my-orders`, {
      method: "GET",
      headers: headers
    });

    if (response.ok) {
      return await response.json();
    }
    console.error("Errore fetch my-orders:", response.status);
    return [];
  } catch (error) {
    console.error("Errore di rete getMyOrders:", error);
    return [];
  }
}