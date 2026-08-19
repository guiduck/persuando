/// <reference types="vite/client" />

import type { PersuandoCaptureApi } from "../preload";

declare global {
  interface Window {
    persuandoCapture?: PersuandoCaptureApi;
  }
}
