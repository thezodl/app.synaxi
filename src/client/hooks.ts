"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import type { Typography } from "@/core/typography";
import { startOfLocalDay, viewKey, type View } from "@/core/views";
import type { ArticleDetail, ArticleListItem } from "@/server/articles";
import type { FeedDto, FolderDto } from "@/server/feeds";
import type { SyncResult, SyncState } from "@/server/sync";

import { api } from "./api";

export type { ArticleDetail, ArticleListItem, FeedDto, FolderDto, SyncState };

export interface Tree {
  folders: FolderDto[];
  feeds: FeedDto[];
  sync: SyncState;
}
interface ArticlePage {
  items: ArticleListItem[];
  nextCursor: string | null;
}

export const keys = {
  tree: ["tree"] as const,
  articles: (v: View) => ["articles", viewKey(v)] as const,
  allArticles: ["articles"] as const,
  article: (id: string) => ["article", id] as const,
};

export function useTree() {
  return useQuery({ queryKey: keys.tree, queryFn: () => api<Tree>("/api/views") });
}

export function useArticles(view: View) {
  return useInfiniteQuery({
    queryKey: keys.articles(view),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ view: viewKey(view) });
      if (pageParam) q.set("cursor", pageParam);
      if (view.kind === "today") q.set("todayStart", String(startOfLocalDay(Date.now())));
      return api<ArticlePage>(`/api/articles?${q}`);
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useArticle(id: string | null) {
  return useQuery({
    queryKey: keys.article(id ?? ""),
    queryFn: () => api<ArticleDetail>(`/api/articles/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

/** Patch an article's bookmark everywhere it's cached (lists + detail), without refetching. */
function patchBookmark(qc: ReturnType<typeof useQueryClient>, id: string, at: number | null) {
  qc.setQueriesData<InfiniteData<ArticlePage>>({ queryKey: keys.allArticles }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((a) => (a.id === id ? { ...a, bookmarkedAt: at } : a)),
          })),
        }
      : data,
  );
  qc.setQueryData<ArticleDetail>(keys.article(id), (a) => (a ? { ...a, bookmarkedAt: at } : a));
}

export function useBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, on, restoreAt }: { id: string; on: boolean; restoreAt?: number }) =>
      api<{ bookmarkedAt: number | null }>(`/api/articles/${id}/bookmark`, {
        method: on ? "PUT" : "DELETE",
        body: on ? JSON.stringify({ restoreAt }) : undefined,
      }),
    onMutate: ({ id, on, restoreAt }) =>
      patchBookmark(qc, id, on ? (restoreAt ?? Date.now()) : null),
    onSuccess: (r, { id }) => {
      patchBookmark(qc, id, r.bookmarkedAt);
      // The Bookmarks list itself changes membership; refetch it.
      qc.invalidateQueries({ queryKey: keys.articles({ kind: "bookmarks" }) });
    },
    onError: () => qc.invalidateQueries({ queryKey: keys.allArticles }),
  });
}

export function useSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (auto: boolean) =>
      api<SyncResult>(`/api/sync${auto ? "?auto=1" : ""}`, { method: "POST" }),
    onSuccess: (r) => {
      if (r.status === "done") {
        qc.invalidateQueries({ queryKey: keys.allArticles });
      }
      qc.invalidateQueries({ queryKey: keys.tree });
    },
  });
}

export function useImportOpml() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (xml: string) =>
      api<{ added: number; skipped: number; total: number }>("/api/opml", {
        method: "POST",
        body: xml,
        headers: { "content-type": "text/x-opml" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tree }),
  });
}

// ---- Phase 2: feed management, typography ----

export interface FoundFeed {
  url: string;
  title: string;
  siteUrl: string | null;
  followed: boolean;
}

export function useDiscover() {
  return useMutation({
    mutationFn: (input: string) =>
      api<{ feeds: FoundFeed[] }>("/api/feeds/discover", {
        method: "POST",
        body: JSON.stringify({ input }),
      }),
  });
}

export function useAddFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: {
      url: string;
      title: string;
      siteUrl: string | null;
      folderId: string | null;
    }) =>
      api<{ id: string; sync: { ok: boolean; added?: number; error?: string } }>("/api/feeds", {
        method: "POST",
        body: JSON.stringify(f),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tree });
      qc.invalidateQueries({ queryKey: keys.allArticles });
    },
  });
}

/** Rename/move feeds and folders, unfollow, folder CRUD: all just refresh the tree (+ lists). */
export function useManage() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.tree });
    qc.invalidateQueries({ queryKey: keys.allArticles });
  };
  const m = <A, R>(fn: (a: A) => Promise<R>) => ({ mutationFn: fn, onSuccess: refresh });
  return {
    updateFeed: useMutation(
      m(({ id, ...patch }: { id: string; title?: string; folderId?: string | null }) =>
        api(`/api/feeds/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
      ),
    ),
    removeFeed: useMutation(
      m((id: string) => api<{ keptBookmarks: number }>(`/api/feeds/${id}`, { method: "DELETE" })),
    ),
    createFolder: useMutation(
      m((name: string) =>
        api<FolderDto>("/api/folders", { method: "POST", body: JSON.stringify({ name }) }),
      ),
    ),
    renameFolder: useMutation(
      m(({ id, name }: { id: string; name: string }) =>
        api(`/api/folders/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
      ),
    ),
    deleteFolder: useMutation(m((id: string) => api(`/api/folders/${id}`, { method: "DELETE" }))),
  };
}

export function useTypography() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ typography: Typography }>("/api/settings"),
    select: (r) => r.typography,
    staleTime: Infinity,
  });
}

export function useSetTypography() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: Typography) =>
      api<{ typography: Typography }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ typography: t }),
      }),
    // Optimistic: the reader restyles immediately.
    onMutate: (t) => qc.setQueryData(["settings"], { typography: t }),
    onSuccess: (r) => qc.setQueryData(["settings"], r),
  });
}

/** Refresh one feed when it's opened. Lists refetch only if something was actually fetched. */
export function useRefreshFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean; added?: number; skipped?: string; error?: string }>(
        `/api/feeds/${id}/sync`,
        { method: "POST" },
      ),
    onSuccess: (r) => {
      if (r.skipped) return;
      if (r.ok && r.added) qc.invalidateQueries({ queryKey: keys.allArticles });
      // lastError / lastFetchedAt changed either way.
      qc.invalidateQueries({ queryKey: keys.tree });
    },
  });
}
