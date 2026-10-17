/*
 * sw.js
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/17, 02:14:31, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Let the web editor open without a connection after one
 *           visit. Network first: when online, every file and the
 *           dictionary come fresh from the site; a copy of each answer
 *           is kept, and served only when the network fails.
 * Contract: Plain JavaScript, copied as it is by Vite [public/]. Never
 *           touches the lexicon manager [/admin/], other sites, or any
 *           request that is not a GET.
 */

const CACHE = "ligurian-keyboard-editor-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const ours = request.method === "GET"
    && url.origin === self.location.origin
    && !url.pathname.includes("/admin/");

  if (ours) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then((cached) => cached ?? Response.error())),
    );
  }
});
