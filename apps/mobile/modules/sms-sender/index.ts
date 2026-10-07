import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** Our own small native module (modules/sms-sender): sends an SMS from the phone without a tap. */
interface SmsSenderModule {
  sendText(phoneNumber: string, message: string): Promise<void>;
}

/** Null on iOS, web, Expo Go and builds made before the module was added. */
export const SmsSender: SmsSenderModule | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<SmsSenderModule>('SmsSender') : null;
