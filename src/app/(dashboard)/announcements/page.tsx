"use client";

import { Megaphone } from "lucide-react";
import { ContentFeed } from "@/components/feed/content-feed";

export default function AnnouncementsPage() {
  return (
    <div className="px-11 pt-9 pb-6 space-y-5 max-[767px]:px-5 max-[767px]:pt-6">
      <div>
        <h1 className="font-serif text-[30px] text-ink flex items-center gap-2.5"><Megaphone className="h-7 w-7 text-accent" /> Announcements</h1>
        <p className="text-[15px] text-[var(--muted)] mt-1">Updates for the team and the store.</p>
      </div>
      <div className="max-w-2xl">
        <ContentFeed emptyLabel="No announcements right now." />
      </div>
    </div>
  );
}
