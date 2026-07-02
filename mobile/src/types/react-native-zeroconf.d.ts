declare module 'react-native-zeroconf' {
  export default class Zeroconf {
    scan(type: string, protocol: string, domain: string): void;
    stop(): void;
    on(event: 'resolved', callback: (service: ResolvedService) => void): void;
    on(event: 'error', callback: (error: unknown) => void): void;
    removeDeviceListeners?(): void;
  }

  interface ResolvedService {
    name?: string;
    host?: string;
    addresses?: string[];
    port?: number;
  }
}
