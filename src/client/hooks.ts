"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

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
