// src/app/[locale]/(main)/downloads/page.tsx
"use client";

import React, { useState, useEffect, useCallback, use } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
    DownloadCloudIcon, PlayCircleIcon, PauseCircleIcon, XCircleIcon, 
    FolderOpenIcon, Trash2Icon, RefreshCwIcon, HistoryIcon, 
    ListChecksIcon, FileTextIcon, Loader2Icon, CheckCircle2Icon, 
    AlertTriangleIcon, InfoIcon, ServerIcon, WifiOffIcon, PowerOffIcon
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useWebTorrent } from "@/contexts/WebTorrentContext";
import type { TorrentProgress, HistoryItem } from "@/lib/webtorrent-service";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { formatBytes } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Locale } from '@/config/i18n.config';
import { getDictionary } from '@/lib/getDictionary';


interface DownloadsPageProps {
  params: { locale: Locale };
}

export default function DownloadsPage(props: DownloadsPageProps) {
  const { locale } = use(props.params);
  const { toast } = useToast();
  const { 
    torrents: activeWebTorrents, 
    history: webTorrentHistory,
    isClientReady,
    pauseTorrent,
    resumeTorrent,
    removeTorrent,
    getLargestFileForStreaming,
    clearDownloadHistory,
    removeDownloadFromHistory,
    addTorrent
  } = useWebTorrent();
  
  const [dictionary, setDictionary] = useState<any>(null);

  useEffect(() => {
    const fetchDict = async () => {
      if (locale) {
        const dict = await getDictionary(locale);
        setDictionary(dict.downloadsPage);
      }
    };
    fetchDict();
  }, [locale]);


  const getStatusInfo = (status: TorrentProgress['status'], noPeersReason?: string) => {
    const statusKey = status?.toLowerCase().replace(/_/g, '') || 'unknown';
    const label = dictionary?.statusLabels?.[statusKey] || `Unknown (${status})`;
    
    switch (status) {
      case "downloading": case "active": 
        return { badge: <Badge variant="default" className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30">{label}</Badge>, icon: <Loader2Icon className="h-4 w-4 text-blue-400 animate-spin" /> };
      case "paused":
        return { badge: <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30">{label}</Badge>, icon: <PauseCircleIcon className="h-4 w-4 text-yellow-400" /> };
      case "completed": case "done": case "seeding": case "complete": 
        return { badge: <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30">{label}</Badge>, icon: <CheckCircle2Icon className="h-4 w-4 text-green-400" /> };
      case "failed": case "error":
        return { badge: <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">{label}</Badge>, icon: <AlertTriangleIcon className="h-4 w-4 text-red-400" /> };
      case "connecting": case "metadata": case "waiting": 
        return { badge: <Badge variant="outline" className="animate-pulse">{label}</Badge>, icon: <Loader2Icon className="h-4 w-4 text-muted-foreground animate-spin" /> };
      case "stalled":
        return { badge: <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30">{label}</Badge>, icon: <PowerOffIcon className="h-4 w-4 text-orange-400" /> };
      case "no_peers":
        return { badge: <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30" title={noPeersReason}>{label}</Badge>, icon: <WifiOffIcon className="h-4 w-4 text-gray-400" /> };
      case "removed":
        return { badge: <Badge variant="outline">{label}</Badge>, icon: <Trash2Icon className="h-4 w-4 text-muted-foreground" /> };
      default:
        return { badge: <Badge variant="outline">{label}</Badge>, icon: <InfoIcon className="h-4 w-4 text-muted-foreground" /> };
    }
  };

  const handlePlayWebTorrent = async (torrentId: string, name?: string) => {
    toast({ title: "Preparing Stream...", description: `Getting file for ${name || 'torrent'}.` });
    try {
        const streamData = await getLargestFileForStreaming(torrentId);
        if (streamData?.file && streamData.streamUrl) {
            // In a real app, you would open a modal with the VideoPlayer component here
            // For now, we'll open the stream URL in a new tab.
            console.log(`[DownloadsPage] Streaming URL: ${streamData.streamUrl}`);
            window.open(streamData.streamUrl, '_blank');
        } else {
            toast({ title: "Stream Failed", description: "Could not find a playable file.", variant: "destructive"});
        }
    } catch (error) {
        toast({ title: "Stream Error", description: `An error occurred while preparing the stream.`, variant: "destructive"});
    }
  };

  const handleRetryWebTorrentDownload = async (item: HistoryItem) => {
    try {
      await addTorrent(item.magnetURI, item.name, item.itemId);
      toast({ title: "Download Re-queued", description: `${item.name} has been added back to active downloads.` });
    } catch (error) {
      toast({ title: "Error Re-queuing", description: (error as Error).message, variant: "destructive" });
    }
  };

  if (!dictionary || !locale) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2Icon className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{dictionary.mainTitle}</h1>
          <p className="text-muted-foreground mt-1">{dictionary.mainDescription}</p>
        </div>
        {!isClientReady && <Badge variant="outline" className="animate-pulse">Initializing Download Client...</Badge>}
      </div>

      <Tabs defaultValue="webtorrent_active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-2 gap-x-1.5 rounded-lg p-1.5 bg-muted h-auto md:h-12 text-base">
          <TabsTrigger value="webtorrent_active" className="h-full py-2.5 px-2 md:px-3">{dictionary.tabs.webTorrents}</TabsTrigger>
          <TabsTrigger value="history" className="h-full py-2.5 px-2 md:px-3 col-span-2 md:col-span-1">{dictionary.tabs.history}</TabsTrigger>
        </TabsList>

        <TabsContent value="webtorrent_active" className="mt-8">
          <Card className="shadow-lg border-border/40 overflow-hidden">
            <CardHeader><CardTitle>{dictionary.activeWebTorrents.title}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {activeWebTorrents.length > 0 ? (
                <div className="divide-y divide-border/30">
                  {activeWebTorrents.map((download) => {
                    const { badge: statusBadge, icon: statusIcon } = getStatusInfo(download.status, download.noPeersReason);
                    return (
                      <div key={download.torrentId} className="p-4 md:p-6 hover:bg-muted/30">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex-grow min-w-0">
                            <h3 className="font-semibold text-md md:text-lg truncate mb-1" title={download.customName || download.torrentId}>{download.customName || dictionary.fetchingName}</h3>
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs md:text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">{statusIcon}{statusBadge}</span>
                              <span>{formatBytes(download.downloaded)} / {download.length ? formatBytes(download.length) : dictionary.na}</span>
                              {(download.status === 'downloading' || download.status === 'connecting' || download.status === 'metadata') && download.downloadSpeed > 0 && (
                                <><span className="hidden sm:inline">&bull;</span><span>{formatBytes(download.downloadSpeed)}/s</span></>
                              )}
                              {download.status === 'downloading' && download.remainingTime !== undefined && Number.isFinite(download.remainingTime) && download.remainingTime > 0 && (
                                <><span className="hidden sm:inline">&bull;</span><span>{dictionary.etaLabel}: {new Date(download.remainingTime).toISOString().substr(11, 8)}</span></>
                              )}
                              <span className="hidden sm:inline">&bull;</span><span>{dictionary.peersLabel}: {download.peers}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 mt-2 sm:mt-0 self-start sm:self-center">
                            {(download.status === 'downloading' || download.status === 'connecting' || download.status === 'metadata' || download.status === 'stalled' || download.status === 'no_peers') && (
                              <Button variant="ghost" size="icon" aria-label={dictionary.pauseLabel} onClick={() => pauseTorrent(download.torrentId)}><PauseCircleIcon className="h-5 w-5" /></Button>
                            )}
                            {download.status === 'paused' && (
                              <Button variant="ghost" size="icon" aria-label={dictionary.resumeLabel} onClick={() => resumeTorrent(download.torrentId)}><PlayCircleIcon className="h-5 w-5" /></Button>
                            )}
                            {(download.status === 'done' || download.status === 'seeding' || (download.status === 'downloading' && download.progress > 0.01)) && (
                              <Button variant="ghost" size="icon" aria-label={dictionary.playStreamLabel} onClick={() => handlePlayWebTorrent(download.torrentId, download.customName)}><PlayCircleIcon className="h-5 w-5" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" aria-label={dictionary.removeLabel} onClick={() => removeTorrent(download.torrentId)}><XCircleIcon className="h-5 w-5" /></Button>
                          </div>
                        </div>
                        <Progress value={download.progress * 100} className="mt-3 h-1.5 md:h-2" indicatorClassName={
                            download.status === 'paused' ? 'bg-yellow-500' : 
                            (download.status === 'error' || download.status === 'failed') ? 'bg-red-500' : 
                            (download.status === 'done' || download.status === 'seeding' ) ? 'bg-green-500' : 
                            (download.status === 'stalled' || download.status === 'no_peers') ? 'bg-orange-500' :
                            'bg-primary'} />
                        {download.status === 'no_peers' && download.noPeersReason && <p className="text-xs text-orange-400 mt-1">{download.noPeersReason}</p>}
                        {download.status === 'stalled' && <p className="text-xs text-orange-400 mt-1">{dictionary.downloadStalledMessage}</p>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 px-6">
                  <DownloadCloudIcon className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold text-muted-foreground">{dictionary.activeWebTorrents.noActiveTitle}</h3>
                  <p className="text-muted-foreground mt-2">{dictionary.activeWebTorrents.noActiveDescription || "Add downloads from movie or TV series pages."}</p> 
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-8">
          <Card className="shadow-lg border-border/40 overflow-hidden">
            <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>{dictionary.history.title}</CardTitle>
                {webTorrentHistory.length > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm"><Trash2Icon className="mr-2 h-4 w-4"/> {dictionary.history.clearAllButton}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>{dictionary.history.alertTitle}</AlertDialogTitle><AlertDialogDescription>{dictionary.history.alertDescription}</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{dictionary.history.alertCancel}</AlertDialogCancel>
                                <AlertDialogAction onClick={clearDownloadHistory}>{dictionary.history.alertConfirm}</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </CardHeader>
            <CardContent className="p-0">
              {webTorrentHistory.length > 0 ? (
                <div className="divide-y divide-border/30">
                  {webTorrentHistory.map(item => {
                    const { badge: statusBadge, icon: statusIcon } = getStatusInfo(item.status);
                    return (
                      <div key={item.infoHash} className={`p-4 md:p-6 hover:bg-muted/30 ${item.status === 'failed' || item.status === 'error' || item.status === 'stalled' ? 'opacity-70' : ''}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex-grow min-w-0">
                            <h3 className="font-semibold text-md md:text-lg truncate mb-1" title={item.name}>{item.name}</h3>
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs md:text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">{statusIcon}{statusBadge}</span>
                              <span>{dictionary.history.addedLabel}: {new Date(item.addedDate).toLocaleDateString()}</span>
                              {item.completedDate && <><span className="hidden sm:inline">&bull;</span><span>{dictionary.history.finishedLabel}: {new Date(item.completedDate).toLocaleDateString()}</span></>}
                              {item.size && <><span className="hidden sm:inline">&bull;</span><span>{dictionary.history.sizeLabel}: {formatBytes(item.size)}</span></>}
                            </div>
                            {item.lastError && <p className="text-xs text-destructive mt-1">{dictionary.history.errorLabel}: {item.lastError}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 mt-2 sm:mt-0 self-start sm:self-center">
                            {(item.status === 'completed') && item.magnetURI && ( 
                                <Button variant="ghost" size="icon" title={dictionary.history.streamAgainLabel} onClick={() => handlePlayWebTorrent(item.magnetURI, item.name)}><PlayCircleIcon className="h-5 w-5" /></Button>
                            )}
                            {(item.status === 'failed' || item.status === 'error' || item.status === 'stalled') && item.magnetURI && (
                              <Button variant="ghost" size="icon" title={dictionary.history.retryLabel} onClick={() => handleRetryWebTorrentDownload(item)}><RefreshCwIcon className="h-5 w-5" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" title={dictionary.history.removeFromHistoryLabel} onClick={() => removeDownloadFromHistory(item.infoHash)}><Trash2Icon className="h-5 w-5" /></Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 px-6">
                  <HistoryIcon className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold text-muted-foreground">{dictionary.history.noHistoryTitle}</h3>
                  <p className="text-muted-foreground mt-1">{dictionary.history.noHistoryDescription}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
