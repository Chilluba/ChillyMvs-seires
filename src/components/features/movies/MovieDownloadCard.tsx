// src/components/features/movies/MovieDownloadCard.tsx
"use client";

import { useState } from "react";
import type { TMDBMovie, YTSMovieTorrent } from "@/types/tmdb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DownloadIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getFullImagePath } from "@/lib/tmdb";
import { useWebTorrent } from "@/contexts/WebTorrentContext";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MovieDownloadCardProps {
  movie: TMDBMovie;
  dictionary: any;
  locale: string;
}

export function MovieDownloadCard({ movie, dictionary, locale }: MovieDownloadCardProps) {
  const { toast } = useToast();
  const { addTorrent, isClientReady, torrents } = useWebTorrent();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleWebTorrentDownload = async (torrent: YTSMovieTorrent) => {
    if (!isClientReady) {
      toast({ title: "WebTorrent Not Ready", description: "Please wait for the WebTorrent client to initialize.", variant: "destructive" });
      return;
    }

    const trackers = [
        'udp://tracker.openbittorrent.com:80/announce',
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://tracker.torrent.eu.org:451/announce',
        'udp://tracker.dler.org:6969/announce',
        'udp://open.stealth.si:80/announce',
    ].map(tr => `&tr=${encodeURIComponent(tr)}`).join('');

    const magnetURI = `magnet:?xt=urn:btih:${torrent.hash}&dn=${encodeURIComponent(movie.title)}${trackers}`;

    setIsLoading(torrent.hash);
    
    try {
      await addTorrent(magnetURI, movie.title, movie.id);
      toast({ title: "Download Queued", description: `${movie.title} (${torrent.quality}) is being added to your active downloads.` });
    } catch (error) {
        console.error("[MovieDownloadCard] Error adding WebTorrent:", error);
        toast({ title: "WebTorrent Error", description: `Could not start download: ${error instanceof Error ? error.message : "Unknown error"}`, variant: "destructive" });
    } finally {
        setIsLoading(null);
    }
  };

  const sortedTorrents = movie.torrents?.sort((a, b) => {
    const qualityA = parseInt(a.quality, 10);
    const qualityB = parseInt(b.quality, 10);
    return qualityB - qualityA;
  }) || [];

  const isDownloading = (hash: string) => torrents.some(t => t.torrentId.toLowerCase() === hash.toLowerCase());

  return (
    <Card className="overflow-hidden shadow-xl sticky top-24">
      <div className="aspect-[2/3] relative w-full bg-muted">
        <Image
          src={getFullImagePath(movie.poster_path, "w500")}
          alt={`${movie.title} poster`}
          fill
          className="object-cover"
          data-ai-hint="movie poster"
          sizes="(max-width: 767px) 100vw, (max-width: 1023px) 33vw, 25vw"
          priority
        />
      </div>
      <CardContent className="p-4 space-y-4">
        <div>
            <h3 className="text-base font-semibold mb-2">Download Options</h3>
            {sortedTorrents.length > 0 ? (
                <div className="space-y-2">
                    {sortedTorrents.map((torrent) => {
                        const downloading = isDownloading(torrent.hash);
                        return (
                            <Button 
                                key={torrent.hash}
                                size="lg" 
                                className="w-full h-12 text-sm justify-between" 
                                onClick={() => handleWebTorrentDownload(torrent)} 
                                disabled={isLoading === torrent.hash || !isClientReady || downloading}
                                variant={downloading ? "secondary" : "default"}
                            >
                                <div className="flex items-center gap-2">
                                    {isLoading === torrent.hash ? <Loader2Icon className="animate-spin h-5 w-5" /> : <DownloadIcon className="h-5 w-5" />}
                                    <div className="text-left">
                                        <p>{downloading ? 'In Downloads' : `${torrent.quality} ${torrent.type.toUpperCase()}`}</p>
                                        <p className="text-xs font-normal opacity-80">{torrent.size}</p>
                                    </div>
                                </div>
                                <Badge variant="outline">{torrent.seeds} Seeds</Badge>
                            </Button>
                        )
                    })}
                </div>
            ) : (
                 <p className="text-sm text-muted-foreground text-center p-4 bg-muted/50 rounded-md">
                    No download links found for this movie.
                </p>
            )}
            {!isClientReady && (
                <div className="flex items-center justify-center text-xs text-muted-foreground mt-2">
                    <Loader2Icon className="animate-spin h-4 w-4 mr-2" />
                    Initializing Download Client...
                </div>
            )}
        </div>
        
        {movie.homepage && (
          <Button variant="outline" className="w-full h-10 text-sm" asChild>
            <Link href={movie.homepage} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="h-4 w-4 mr-2" /> Visit Homepage
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
