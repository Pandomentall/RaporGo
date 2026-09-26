import type { RaporgoApi } from '../shared/api.js';

declare global {
  interface Window {
    raporgo: RaporgoApi;
  }
}

export {};
