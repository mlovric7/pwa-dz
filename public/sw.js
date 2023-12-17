import {del, entries} from './idb-keyval.js';

const filesToCache = ['/', 'manifest.json', 'index.html', 'offline.html', 'not-found.html', 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css', 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js', 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.5.0/font/bootstrap-icons.css'];

const staticCacheName = 'static-cache-v4';
const dynamicCacheName = 'dynamic-cache'

self.addEventListener('install', (event) => {
    console.log('Attempting to install service worker and cache static assets');
    event.waitUntil(caches.open(staticCacheName).then((cache) => {
        return cache.addAll(filesToCache);
    }));
});

self.addEventListener('activate', (event) => {
    console.log('**************************************');
    console.log('** Activating new service worker... **');
    console.log('**************************************');

    const cacheWhitelist = [staticCacheName];
    event.waitUntil(caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
                return caches.delete(cacheName);
            }
        }));
    }));
});

// Network first
self.addEventListener('fetch', (event) => {
    if (event.request.url.startsWith('http') && event.request.method === 'GET') {
        event.respondWith(fetch(event.request).then((networkResponse) => {
            // If the fetch is successful, update the cache with the new response
            if (networkResponse.ok) {
                return caches.open(dynamicCacheName).then((cache) => {
                    cache.put(event.request.url, networkResponse.clone());
                    return networkResponse;
                });
            }

            // Check for 404 status
            if (networkResponse.status === 404 && event.request.headers.get('Accept').includes('application/json')) {
                // Return a JSON 404 response
                return new Response(JSON.stringify({error: 'Not found'}), {
                    status: 404, headers: {'Content-Type': 'application/json'}
                });
            }

            if (networkResponse.status === 404) {
                return caches.match('not-found.html').then(response => {
                    return response || fetch('not-found.html');
                });
            }
            return networkResponse;
        }).catch(() => {
            // If the network fetch fails, try to return the cached response
            return caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                console.log('aaaaa')
                // If no cached response is found, return an offline page
                return caches.match('offline.html');
            });
        }));
    }
});

self.addEventListener('sync', function (event) {
    console.log('Background sync!', event);
    if (event.tag.startsWith('sync-images')) {
        event.waitUntil(syncImages(event.tag.split('$')[1]));
    }
    if (event.tag.startsWith('sync-destinations')) {
        event.waitUntil(syncDestinations());
    }
});

let syncDestinations = async function (destination) {
    entries().then((entries) => {
        entries.forEach((entry) => {
            console.log(entry)
            let image = entry[1];
            if (!image.destination) {
                return;
            }
            let formData = new FormData();
            formData.append('id', image.id);
            formData.append('ts', image.ts);
            formData.append('title', image.title);
            formData.append('image', image.image, image.id + '.png');
            fetch('/save-destination?destination=' + image.destination, {
                method: 'POST', body: formData,
            })
                .then(function (res) {
                    if (res.ok) {
                        res.json().then(function (data) {
                            console.log('Deleting from idb:', data.id);
                            del(data.id);
                        });
                    } else {
                        console.log(res);
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        });
    });
}

let syncImages = async function (destination) {
    entries().then((entries) => {
        entries.forEach((entry) => {
            console.log(entry)
            let image = entry[1];
            if (image.destination) {
                return;
            }
            let formData = new FormData();
            formData.append('id', image.id);
            formData.append('ts', image.ts);
            formData.append('title', image.title);
            formData.append('image', image.image, image.id + '.png');
            fetch('/save-image?destination=' + destination, {
                method: 'POST', body: formData,
            })
                .then(function (res) {
                    if (res.ok) {
                        res.json().then(function (data) {
                            console.log('Deleting from idb:', data.id);
                            del(data.id);
                        });
                    } else {
                        console.log(res);
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        });
    });
};

self.addEventListener('notificationclick', (event) => {
    let notification = event.notification;
    notification.close();
    console.log('notificationclick', notification);

    event.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true})
        .then(async function (windowClients) {
            if (windowClients && windowClients.length > 0) {
                let client = windowClients[0]
                client = await client.navigate(notification.data.redirectUrl);
                return client.focus();
            } else if (clients.openWindow) {
                return clients.openWindow(notification.data.redirectUrl)
            }
        }));
});

self.addEventListener('push', function (event) {
    console.log('push event', event);

    let data = {title: 'title', body: 'body', redirectUrl: '/'};

    if (event.data) {
        data = JSON.parse(event.data.text());
    }

    const options = {
        body: data.body,
        icon: 'assets/img/android/android-launchericon-96-96.png',
        badge: 'assets/img/android/android-launchericon-96-96.png',
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        data: {
            redirectUrl: data.redirectUrl,
        },
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});
