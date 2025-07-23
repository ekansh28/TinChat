// types/butterchurn.d.ts
declare module 'butterchurn' {
  interface ButterchurnOptions {
    width?: number;
    height?: number;
    pixelRatio?: number;
    textureRatio?: number;
  }

  interface ButterchurnPreset {
    name: string;
    butterchurnPresetObject: any;
  }

  class Butterchurn {
    constructor(options?: ButterchurnOptions);
    loadPreset(preset: any, blendTime?: number): void;
    setRendererSize(width: number, height: number, pixelRatio?: number): void;
    render(): void;
    launchSongTitleAnim(text: string): void;
    connectAudio(audioNode: AudioNode): void;
    disconnect(): void;
    destroy(): void;
  }

  export default Butterchurn;
  export function createVisualizer(audioContext: AudioContext, canvas: HTMLCanvasElement, options?: ButterchurnOptions): Butterchurn;
  export function isSupported(): boolean;
}

declare module 'butterchurn-presets' {
  interface PresetCollection {
    [key: string]: any;
  }

  export function getPresets(): PresetCollection;
  export function getPresetNames(): string[];
}

declare module 'butterchurn/lib/isSupported.min' {
  function isSupported(): boolean;
  export default isSupported;
}

declare module 'webamp' {
  interface Track {
    metaData: {
      artist: string;
      title: string;
      album?: string;
      year?: string;
      genre?: string;
    };
    url: string;
    duration: number;
  }

  interface WindowLayout {
    main?: { position: { top: number; left: number } };
    equalizer?: { position: { top: number; left: number } };
    playlist?: {
      position: { top: number; left: number };
      size?: { extraWidth: number; extraHeight: number };
    };
    milkdrop?: {
      position: { top: number; left: number };
      size?: { extraHeight: number; extraWidth: number };
    };
  }

  interface WebampOptions {
    initialTracks?: Track[];
    windowLayout?: WindowLayout;
    __butterchurnOptions?: {
      importButterchurn: () => Promise<any>;
      getPresets: () => Array<{ name: string; butterchurnPresetObject: any }>;
      butterchurnOpen?: boolean;
    };
    enableHotkeys?: boolean;
    zIndex?: number;
  }

  class Webamp {
    constructor(options: WebampOptions);
    renderWhenReady(node: HTMLElement): Promise<void>;
    dispose(): void;
    play(): void;
    pause(): void;
    stop(): void;
    nextTrack(): void;
    previousTrack(): void;
    seekToTime(time: number): void;
    setVolume(volume: number): void;
    onTrackDidChange(callback: (track: Track | null) => void): () => void;
    onWillClose(callback: () => void): () => void;
  }

  export = Webamp;
}