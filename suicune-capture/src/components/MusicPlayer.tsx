"use client";

import { useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════
   MUSIC PLAYER — YouTube background audio
   Uses hidden iframe to play YouTube audio.
   Note: autoplay requires user interaction first
   (quiz start, battle start, etc.)
   
   Music tracks:
   - Quiz:          coS_Uua9B-o
   - Beasts 3v3:    ok3_XzQWr-s
   - Ho-Oh battle:  oyBkdZNT1DE
   - Credits:       slvKqu-6AZI
   ═══════════════════════════════════════════════ */

export type MusicTrack = "quiz" | "beasts" | "hooh" | "credits" | "none";

const TRACK_IDS: Record<MusicTrack, string> = {
  quiz:    "coS_Uua9B-o",
  beasts:  "ok3_XzQWr-s",
  hooh:    "oyBkdZNT1DE",
  credits: "slvKqu-6AZI",
  none:    "",
};

interface MusicPlayerProps {
  track: MusicTrack;
  volume?: number; // 0-100, default 30
}

export function MusicPlayer({ track, volume = 30 }: MusicPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (track === "none" || !TRACK_IDS[track]) return null;

  const videoId = TRACK_IDS[track];

  return (
    <iframe
      ref={iframeRef}
      key={track}
      style={{ display: "none", position: "absolute", width: 0, height: 0 }}
      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&mute=0&volume=${volume}`}
      allow="autoplay; encrypted-media"
      title="background-music"
    />
  );
}