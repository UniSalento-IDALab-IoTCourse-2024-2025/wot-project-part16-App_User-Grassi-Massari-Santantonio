# FastGo User Mobile App

Questa è l'applicazione mobile dedicata ai clienti (User) della piattaforma FastGo. Sviluppata con **React Native** ed **Expo**, permette agli utenti di localizzare i ristoranti nelle vicinanze, effettuare ordini e monitorare lo stato della consegna in tempo reale grazie all'integrazione MQTT.

## Stack Tecnologico

* **Framework:** React Native (via Expo SDK 50+)
* **Routing:** Expo Router (File-based routing)
* **Styling:** NativeWind (Tailwind CSS per React Native)
* **Mappe:** react-native-maps (Integrazione Google Maps/Apple Maps)
* **Real-time:** MQTT (via WebSockets)
* **Notifiche:** expo-notifications

## Struttura del Progetto

.
├── app/
│   ├── (auth)/             # Flusso di autenticazione (Login, Registrazione)
│   ├── (tabs)/             # Navigazione principale (Mappa, Ordini, Profilo)
│   ├── _layout.tsx         # Gestione globale del routing e protezione rotte
│   └── modal.tsx           # Schermate modali
├── components/             # Componenti UI (Card, Marker Mappa, BottomSheets)
├── context/
│   └── AuthContext.tsx     # Gestione stato utente e persistenza token
├── lib/
│   ├── api.ts              # Chiamate REST al backend
│   └── utils.ts            # Funzioni di utilità
└── assets/                 # Risorse statiche

## Prerequisiti

* Node.js (LTS)
* npm o yarn
* Emulatore Android/iOS o dispositivo fisico

## Installazione

1. Installare le dipendenze del progetto:
   npm install

2. Generare la cartella nativa (necessaria per mappe e permessi di localizzazione):
   npx expo prebuild

## Configurazione IP e MQTT

L'applicazione comunica con il backend e il broker MQTT. È necessario configurare gli indirizzi IP corretti in base al proprio ambiente di rete.

1. **Broker MQTT:**
   Aprire il file `app/(tabs)/order.tsx` e aggiornare la costante `MQTT_BROKER_WS`:
   
   // Per emulatore Android
   const MQTT_BROKER_WS = 'ws://10.0.2.2:9001';
   
   // Per dispositivo fisico (usare l'IP locale del PC)
   const MQTT_BROKER_WS = 'ws://192.168.1.X:9001';

2. **Backend API:**
   Verificare l'URL base nel file `lib/api.ts` (o dove configurato) per puntare al Gateway corretto.

## Avvio dell'Applicazione

Per avviare l'applicazione in modalità sviluppo:

npx expo run:android
# oppure
npx expo run:ios

## Funzionalità Principali

### 1. Mappa e Geolocalizzazione
* La schermata Home (`app/(tabs)/index.tsx`) utilizza `react-native-maps`.
* Richiede i permessi di localizzazione per centrare la mappa sull'utente.
* Mostra i ristoranti nelle vicinanze tramite marker interattivi.
* **Fallback:** Se il GPS non è disponibile, la mappa si centra su una posizione di default (Lecce).

### 2. Gestione Ordini e Tracking Real-time
* La schermata Ordini (`app/(tabs)/order.tsx`) mostra lo storico e gli ordini attivi.
* Si connette al Broker MQTT sulla porta **9001** (WebSockets).
* Sottoscrive i topic relativi agli ordini attivi (`shop/{shopId}/{orderId}`).
* Riceve aggiornamenti di stato istantanei e invia una **notifica locale** all'utente quando lo stato cambia (es. "In Consegna", "Consegnato").

### 3. Autenticazione
* Gestisce Login e Registrazione.
* Impedisce l'accesso alla dashboard se l'utente non ha il ruolo `USER`.
* Gestisce la persistenza della sessione.

## Permessi Richiesti

* `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`: Per la ricerca ristoranti e indirizzo consegna.
* `NOTIFICATIONS`: Per notificare i cambi di stato dell'ordine.