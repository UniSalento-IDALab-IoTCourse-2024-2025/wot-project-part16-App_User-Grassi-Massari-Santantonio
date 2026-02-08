import 'dotenv/config';

export default {
  expo: {
    name: "FastGoUser",
    slug: "FastGoUser",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/Supercat _preview_rev_1.png",
    scheme: "fastgouser",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    
    extra: {
      eas: {
        projectId: "b9316012-0d4b-4c5a-9656-016d70986811"
      }
    },
    // -------------------------------------

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.fastgo.user"
    },
    android: {
      package: "com.fastgo.user",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      permissions: [
        "INTERNET",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "POST_NOTIFICATIONS"
      ],
      usesCleartextTraffic: true,
      config: {
        googleMaps: {
          apiKey: "" //process.env.GOOGLE_MAPS_API_KEY 
        }
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ],
     
      [
        "expo-build-properties",
        {
          "android": {
            "usesCleartextTraffic": true
          }
        }
      ],
        
      "expo-location",
      "expo-secure-store",
      [
        "expo-notifications", 
        {
          "icon": "./assets/images/icon.png", 
          "color": "#2563EB",
          "defaultChannel": "default"
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    }
  }
};