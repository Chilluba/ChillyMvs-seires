// src/lib/webtorrent-service.ts
import { Buffer } from 'buffer';
import EventEmitter from 'events';

// Polyfills for browser environment
if (typeof window !== 'undefined') {
  if (typeof (window as any).Buffer === 'undefined') (window as any).Buffer = Buffer;
  if (typeof (window as any).process === 'undefined') {
    (window as any).process = {
      env: { DEBUG: undefined },
      browser: true,
      version: 'v0.0.0',
      versions: { node: '0.0.0' },
      nextTick: (callback: (...args: any[]) => void, ...args: any[]) => setTimeout(() => callback(...args), 0),
    };
  }
  if (typeof (window as any).global === 'undefined') (window as any).global = window;
}

// Dynamically import WebTorrent only on the client-side
let ActualWebTorrent: any = null;
if (typeof window !== 'undefined') {
  import('webtorrent').then(module => {
    ActualWebTorrent = module.default;
  });
}
import type { Instance as WebTorrentInstance, Torrent as WebTorrentAPITorrent, TorrentFile as WebTorrentAPITorrentFile } from 'webtorrent';


// Re-exporting types for clarity, these now represent the actual webtorrent types
export type Torrent = WebTorrentAPITorrent & {
  customName?: string;
  addedDate?: Date;
  itemId?: string | number;
  statusForHistory?: HistoryItem['status'];
  lastProgressTime?: number;
  noPeersReason?: string;
};
export type TorrentFile = WebTorrentAPITorrentFile;

export type TorrentProgressStatus = 
  | 'idle' 
  | 'downloading' 
  | 'seeding' 
  | 'paused' 
  | 'error' 
  | 'connecting' 
  | 'done' 
  | 'metadata' 
  | 'stalled'
  | 'no_peers';

export type TorrentProgress = {
  torrentId: string; 
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  peers: number;
  remainingTime?: number;
  downloaded: number;
  length?: number;
  customName?: string;
  addedDate?: Date;
  itemId?: string | number;
  status: TorrentProgressStatus;
  noPeersReason?: string; 
};

export interface HistoryItem {
  infoHash: string;
  magnetURI: string;
  name: string;
  itemId?: string | number;
  addedDate: string;
  completedDate?: string;
  status: 'completed' | 'failed' | 'removed' | 'active' | 'error' | 'stalled';
  size?: number;
  lastError?: string;
}

const HISTORY_STORAGE_KEY = 'chillymovies_download_history_v2';
const STALL_TIMEOUT = 30000; // 30 seconds
const NO_PEERS_TIMEOUT = 60000; // 60 seconds

class WebTorrentService extends EventEmitter {
  private client: WebTorrentInstance | null = null;
  private history: HistoryItem[] = [];
  private progressInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    if (typeof window !== 'undefined') {
        this.loadHistory();
    }
  }
  
  public async getClient(): Promise<WebTorrentInstance> {
    if (this.client) return this.client;
    if (!ActualWebTorrent) {
      // Wait for dynamic import to complete
      await new Promise<void>(resolve => {
        const check = () => {
          if (ActualWebTorrent) resolve();
          else setTimeout(check, 100);
        };
        check();
      });
    }
    this.client = new ActualWebTorrent();
    this.startProgressEmitter();
    return this.client;
  }
  
  private startProgressEmitter() {
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.progressInterval = setInterval(() => {
        if (!this.client) return;
        this.client.torrents.forEach(torrent => this.emit('progress', this.getTorrentProgress(torrent as Torrent)));
    }, 1000);
  }

  private loadHistory() {
    try {
      const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      this.history = storedHistory ? JSON.parse(storedHistory) : [];
      this.emit('historyUpdated');
    } catch (error) {
      console.error("Failed to load or parse download history:", error);
      this.history = [];
    }
  }
  
  private saveHistory() {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history));
      this.emit('historyUpdated');
    } catch (error) {
      console.error("Failed to save download history:", error);
    }
  }
  
  public getDownloadHistory = (): HistoryItem[] => [...this.history];
  
  public clearHistory = () => {
    this.history = [];
    this.saveHistory();
  };
  
  public removeFromHistory = (infoHash: string) => {
    this.history = this.history.filter(item => item.infoHash !== infoHash);
    this.saveHistory();
  }

  private updateHistory(torrent: Torrent, status?: HistoryItem['status'], lastError?: string) {
    const existingIndex = this.history.findIndex(item => item.infoHash === torrent.infoHash);
    const newStatus = status || torrent.statusForHistory || 'active';
    if (existingIndex > -1) {
      this.history[existingIndex] = {
        ...this.history[existingIndex],
        status: newStatus,
        completedDate: newStatus === 'completed' ? new Date().toISOString() : this.history[existingIndex].completedDate,
        lastError: lastError || this.history[existingIndex].lastError,
        size: torrent.length,
      };
    } else {
      this.history.unshift({
        infoHash: torrent.infoHash,
        magnetURI: torrent.magnetURI,
        name: torrent.customName || torrent.name,
        itemId: torrent.itemId,
        addedDate: (torrent.addedDate || new Date()).toISOString(),
        status: newStatus,
        size: torrent.length,
        lastError,
      });
    }
    this.saveHistory();
  }

  async addTorrent(magnetURI: string, itemName?: string, itemId?: string | number): Promise<Torrent | null> {
    const client = await this.getClient();
    if (client.get(magnetURI)) {
      console.warn("Torrent already added:", magnetURI);
      return null;
    }

    return new Promise((resolve, reject) => {
        const torrent = client.add(magnetURI, (torrentInstance) => {
            const enhancedTorrent = torrentInstance as Torrent;
            enhancedTorrent.customName = itemName;
            enhancedTorrent.itemId = itemId;
            enhancedTorrent.addedDate = new Date();
            enhancedTorrent.lastProgressTime = Date.now();
            
            console.log('Torrent added:', enhancedTorrent.infoHash);
            this.updateHistory(enhancedTorrent, 'active');
            
            enhancedTorrent.on('done', () => {
                console.log('Torrent done:', enhancedTorrent.infoHash);
                enhancedTorrent.statusForHistory = 'completed';
                this.updateHistory(enhancedTorrent, 'completed');
                this.emit('done', enhancedTorrent);
            });
            
            enhancedTorrent.on('error', (err) => {
                console.error('Torrent error:', enhancedTorrent.infoHash, err);
                enhancedTorrent.statusForHistory = 'error';
                const errorMessage = typeof err === 'string' ? err : err.message;
                this.updateHistory(enhancedTorrent, 'error', errorMessage);
                this.emit('error', enhancedTorrent, err);
            });

            this.emit('added', enhancedTorrent);
            resolve(enhancedTorrent);
        }) as Torrent;

        // If 'add' immediately returns a torrent object (it does for magnet links)
        if (torrent) {
            // Attach an early error handler for invalid magnet links etc.
            torrent.once('error', (err) => {
                reject(err);
                client.remove(magnetURI, () => {});
            });
        }
    });
  }
  
  getAllTorrentsProgress(): TorrentProgress[] {
    return this.client?.torrents.map(t => this.getTorrentProgress(t as Torrent)) || [];
  }

  private getTorrentProgress(torrent: Torrent): TorrentProgress {
    let status: TorrentProgressStatus = 'connecting';
    if (torrent.ready) {
        if (torrent.done) status = torrent.uploadSpeed > 0 ? 'seeding' : 'done';
        else if (torrent.paused) status = 'paused';
        else status = 'downloading';
    } else {
        status = 'metadata';
    }

    if (status === 'downloading' && torrent.downloadSpeed === 0 && torrent.numPeers > 0) {
        const now = Date.now();
        if (now - (torrent.lastProgressTime || now) > STALL_TIMEOUT) {
            status = 'stalled';
        }
    } else if (status === 'downloading') {
        torrent.lastProgressTime = Date.now();
    }
    
    if (status !== 'done' && status !== 'seeding' && torrent.numPeers === 0 && Date.now() - (torrent.addedDate?.getTime() || 0) > NO_PEERS_TIMEOUT) {
        status = 'no_peers';
        torrent.noPeersReason = "No peers found after 60 seconds.";
    }

    return {
      torrentId: torrent.infoHash,
      progress: torrent.progress,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      peers: torrent.numPeers,
      remainingTime: torrent.timeRemaining,
      downloaded: torrent.downloaded,
      length: torrent.length,
      customName: torrent.customName,
      addedDate: torrent.addedDate,
      itemId: torrent.itemId,
      status: status,
      noPeersReason: torrent.noPeersReason
    };
  }

  async removeTorrent(infoHashOrMagnetURI: string): Promise<void> {
    const client = await this.getClient();
    const torrent = client.get(infoHashOrMagnetURI) as Torrent;
    if (torrent) {
      this.updateHistory(torrent, 'removed');
      client.remove(infoHashOrMagnetURI, (err) => {
          if (err) console.error("Error removing torrent:", err);
          else this.emit('removed', torrent.infoHash);
      });
    }
  }

  pauseTorrent(infoHashOrMagnetURI: string) {
    const torrent = this.client?.get(infoHashOrMagnetURI) as Torrent;
    if (torrent && !torrent.paused) {
      torrent.pause();
      torrent.statusForHistory = 'paused';
      this.updateHistory(torrent);
    }
  }

  resumeTorrent(infoHashOrMagnetURI: string) {
    const torrent = this.client?.get(infoHashOrMagnetURI) as Torrent;
    if (torrent && torrent.paused) {
      torrent.resume();
      torrent.statusForHistory = 'active';
      this.updateHistory(torrent);
    }
  }
  
  getTorrent = (infoHashOrMagnetURI: string): Torrent | undefined => this.client?.get(infoHashOrMagnetURI) as Torrent;

  async getLargestFileForStreaming(infoHashOrMagnetURI: string): Promise<{ file: TorrentFile, streamUrl: string } | null> {
    const torrent = this.getTorrent(infoHashOrMagnetURI);
    if (!torrent || !torrent.ready) return null;

    const file = torrent.files.reduce((a, b) => (a.length > b.length ? a : b));
    if (!file) return null;
    
    return new Promise(resolve => {
        const server = (file as any).createServer();
        server.listen(0, () => {
            const port = (server.address() as any).port;
            const streamUrl = `http://localhost:${port}/0`; // Assuming file index 0 on this server
            resolve({ file, streamUrl });
        });
    });
  }

  onTorrentProgress(listener: (progress: TorrentProgress) => void): () => void {
    this.on('progress', listener);
    return () => this.off('progress', listener);
  }
  onTorrentAdded(listener: (torrent: Torrent) => void): () => void {
    this.on('added', listener);
    return () => this.off('added', listener);
  }
  onTorrentRemoved(listener: (infoHash: string) => void): () => void {
    this.on('removed', listener);
    return () => this.off('removed', listener);
  }
  onTorrentDone(listener: (torrent: Torrent) => void): () => void {
    this.on('done', listener);
    return () => this.off('done', listener);
  }
  onTorrentError(listener: (torrent: Partial<Torrent> | null, error: Error | string) => void): () => void {
    this.on('error', listener);
    return () => this.off('error', listener);
  }
   onHistoryUpdated(listener: () => void): () => void {
    this.on('historyUpdated', listener);
    return () => this.off('historyUpdated', listener);
  }
}

const webTorrentService = new WebTorrentService();
export default webTorrentService;
