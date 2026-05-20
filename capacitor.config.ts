import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arielbasseterre.personalflightlog',
  appName: 'Personal Flight Log',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
