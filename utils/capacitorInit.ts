/**
 * Must be imported before `./App` in `index.tsx` so Capacitor fetch patching runs
 * before any module that constructs DataService (which calls getApiBaseUrl).
 */
import { patchFetchForCapacitor } from './apiConfig';

patchFetchForCapacitor();
