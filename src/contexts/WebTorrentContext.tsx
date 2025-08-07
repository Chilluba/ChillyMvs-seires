// src/contexts/WebTorrentContext.tsx
import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import webTorrentService from '@/lib/webtorrent-service';
import type { Torrent, TorrentProgress, HistoryItem } from '@/lib/webtorrent-service';
import type { TorrentFile as WebTorrentFile } from 'webtorrent';

interface WebTorrentContextType {
  torrents: TorrentProgress[];
  history: HistoryItem[];
  addTorrent: (magnetURI: string, itemName?: string, itemId?: string | number) => Promise<Torrent | null>;
  removeTorrent: (infoHashOrMagnetURI: string) => Promise<void>;
  pauseTorrent: (infoHashOrMagnetURI: string) => void;
  resumeTorrent: (infoHashOrMagnetURI: string) => void;
  getTorrentInstance: (infoHashOrMagnetURI: string) => Torrent | undefined;
  getLargestFileForStreaming: (infoHashOrMagnetURI: string) => Promise<{ file: WebTorrentFile, streamUrl: string } | null>;
  clearDownloadHistory: () => void;
  removeDownloadFromHistory: (infoHash: string) => void;
  isClientReady: boolean;
}

const WebTorrentContext = createContext<WebTorrentContextType | undefined>(undefined);

export const useWebTorrent = (): WebTorrentContextType => {
  const context = useContext(WebTorrentContext);
  if (!context) {
    throw new Error('useWebTorrent must be used within a WebTorrentProvider');
  }
  return context;
};

interface WebTorrentProviderProps {
  children: ReactNode;
}

export const WebTorrentProvider: React.FC<WebTorrentProviderProps> = ({ children }) => {
  const [torrents, setTorrents] = useState<TorrentProgress[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    const initializeClient = async () => {
      await webTorrentService.getClient();
      setIsClientReady(true);
      setTorrents(webTorrentService.getAllTorrentsProgress());
      setHistory(webTorrentService.getDownloadHistory());
    };

    initializeClient();

    const unsubscribeProgress = webTorrentService.onTorrentProgress((progress) => {
      setTorrents(prev => {
        const index = prev.findIndex(t => t.torrentId === progress.torrentId);
        if (index > -1) {
          const newTorrents = [...prev];
          newTorrents[index] = progress;
          return newTorrents;
        }
        return [...prev, progress];
      });
    });

    const unsubscribeRemoved = webTorrentService.onTorrentRemoved((infoHash) => {
      setTorrents(prev => prev.filter(t => t.torrentId !== infoHash));
    });
    
    const unsubscribeHistory = webTorrentService.onHistoryUpdated(() => {
        setHistory(webTorrentService.getDownloadHistory());
    });

    return () => {
      unsubscribeProgress();
      unsubscribeRemoved();
      unsubscribeHistory();
    };
  }, []);

  const addTorrent = useCallback(async (magnetURI: string, itemName?: string, itemId?: string | number) => {
    return webTorrentService.addTorrent(magnetURI, itemName, itemId);
  }, []);

  const removeTorrent = useCallback(async (infoHashOrMagnetURI: string) => {
    await webTorrentService.removeTorrent(infoHashOrMagnetURI);
  }, []);
  
  const pauseTorrent = useCallback((infoHashOrMagnetURI: string) => {
    webTorrentService.pauseTorrent(infoHashOrMagnetURI);
  }, []);

  const resumeTorrent = useCallback((infoHashOrMagnetURI: string) => {
    webTorrentService.resumeTorrent(infoHashOrMagnetURI);
  }, []);

  const getTorrentInstance = useCallback((infoHashOrMagnetURI: string) => {
    return webTorrentService.getTorrent(infoHashOrMagnetURI);
  }, []);
  
  const getLargestFileForStreaming = useCallback(async (infoHashOrMagnetURI: string) => {
    return webTorrentService.getLargestFileForStreaming(infoHashOrMagnetURI);
  }, []);

  const clearDownloadHistory = useCallback(() => {
    webTorrentService.clearHistory();
  }, []);

  const removeDownloadFromHistory = useCallback((infoHash: string) => {
    webTorrentService.removeFromHistory(infoHash);
  }, []);

  const value: WebTorrentContextType = {
    torrents,
    history,
    addTorrent,
    removeTorrent,
    pauseTorrent,
    resumeTorrent,
    getTorrentInstance,
    getLargestFileForStreaming,
    clearDownloadHistory,
    removeDownloadFromHistory,
    isClientReady,
  };

  return (
    <WebTorrentContext.Provider value={value}>
      {children}
    </WebTorrentContext.Provider>
  );
};
