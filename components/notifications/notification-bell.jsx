"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, CheckCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePolling } from "@/lib/use-polling";
import { changesFromNotification, relativeTime } from "@/lib/audit-format";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications-api";
import { ChangeList } from "@/components/audit/change-list";

function NotificationRow({ note, onClick }) {
  const changes = changesFromNotification(note.changes);
  const unread = !note.readAt;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full gap-2 border-b border-slate-100 px-3 py-2.5 text-left outline-none transition-colors last:border-b-0 hover:bg-slate-50",
        unread && "bg-brand/[0.035]"
      )}
    >
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          unread ? "bg-brand" : "bg-transparent"
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-slate-900">{note.title}</span>
          <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(note.createdAt)}</span>
        </span>
        {note.body ? <span className="mt-0.5 block text-xs text-slate-500">{note.body}</span> : null}
        <ChangeList changes={changes} max={3} />
        {note.actorName ? (
          <span className="mt-1 block text-[11px] text-slate-400">by {note.actorName}</span>
        ) : null}
      </span>
    </button>
  );
}

/** Notification bell + unread badge + dropdown panel. Renders inside the ERP navbar. */
export function NotificationBell({ className }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      setCount(await fetchUnreadCount());
    } catch {
      // ignore — keep last known count
    }
  }, []);

  // Poll the unread count every 60s (paused when the tab is hidden).
  usePolling(refreshCount, { intervalMs: 60000 });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCount();
  }, [refreshCount]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchNotifications({ perPage: 30 }));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) loadList();
  }, [open, loadList]);

  const handleItemClick = async (note) => {
    if (!note.readAt) {
      try {
        await markNotificationRead(note.id);
      } catch {
        // ignore
      }
    }
    setOpen(false);
    refreshCount();
    if (note.route) router.push(note.route);
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
    } catch {
      // ignore
    }
    await Promise.all([refreshCount(), loadList()]);
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? `Notifications (${count} unread)` : "Notifications"}
          className={cn(
            "relative flex size-8 items-center justify-center rounded-md text-slate-600 outline-none ring-brand/35 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 md:size-9 md:rounded-lg",
            className
          )}
        >
          <Bell className="size-[1.05rem] md:size-[1.15rem]" aria-hidden />
          {count > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <span className="font-semibold text-slate-900">Notifications</span>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={count === 0}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-default disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Mark all read
            </button>
          </div>
          <div className="max-h-[26rem] overflow-y-auto">
            {loading ? (
              <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-slate-400">You&apos;re all caught up.</p>
            ) : (
              items.map((note) => (
                <NotificationRow key={note.id} note={note} onClick={() => handleItemClick(note)} />
              ))
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
