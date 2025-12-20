import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configuration du comportement des notifications quand l'app est ouverte
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Afficher l'alerte même si l'app est au premier plan
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Enregistre l'appareil pour les notifications Push et retourne le token
 */
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // Si pas encore de permission, on demande
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permission de notification refusée !');
      return null;
    }

    // Récupération du token
    try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        if (!projectId) {
            token = (await Notifications.getExpoPushTokenAsync()).data;
        } else {
            token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        }
        console.log("🔔 Push Token récupéré:", token);
    } catch (e) {
        console.error("Erreur récupération Push Token:", e);
    }
  } else {
    console.log('Les notifications Push ne marchent que sur un vrai appareil physique.');
  }

  return token;
}

/**
 * Envoie une notification à un token spécifique
 */
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data: any = {}) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    });
  } catch (error) {
    console.error("Erreur envoi notif:", error);
  }
}

/**
 * Programme une notification locale de rappel (retention)
 * @param seconds Délai en secondes avant l'envoi
 */
export async function scheduleRetentionNotification(seconds: number = 172800) { // 48h par défaut
  try {
    // On commence par nettoyer les anciens rappels pour éviter les doublons
    await cancelAllScheduledNotifications();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Who Listening vous manque ? 🎵",
        body: "Tes amis sont peut-être déjà en train de jouer ! Reviens tester ta culture musicale.",
        sound: 'default',
        data: { screen: 'Welcome' },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: seconds,
        repeats: false,
      },
    });
    console.log(`⏰ Notification de rappel programmée dans ${seconds}s (ID: ${id})`);
    return id;
  } catch (error) {
    console.error("Erreur programmation notif locale:", error);
    return null;
  }
}

/**
 * Annule toutes les notifications programmées
 */
export async function cancelAllScheduledNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("🧹 Toutes les notifications programmées ont été annulées.");
  } catch (error) {
    console.error("Erreur annulation notifs:", error);
  }
}
