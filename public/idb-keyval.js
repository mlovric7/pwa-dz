function promisifyRequest(request) {
    return new Promise(function (resolve, reject) {
        // @ts-ignore - file size hacks
        request.oncomplete = request.onsuccess = function () {
            return resolve(request.result);
        }; // @ts-ignore - file size hacks


        request.onabort = request.onerror = function () {
            return reject(request.error);
        };
    });
}

function createStore(dbName, storeName) {
    const dbp = Promise.resolve().then(function () {
        const request = indexedDB.open(dbName);

        request.onupgradeneeded = function () {
            return request.result.createObjectStore(storeName);
        };

        return promisifyRequest(request);
    });
    return function (txMode, callback) {
        return dbp.then(function (db) {
            return callback(db.transaction(storeName, txMode).objectStore(storeName));
        });
    };
}

var defaultGetStoreFunc;

function defaultGetStore() {
    if (!defaultGetStoreFunc) {
        defaultGetStoreFunc = createStore('keyval-store', 'keyval');
    }

    return defaultGetStoreFunc;
}

/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */


function del(key) {
    var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
    return customStore('readwrite', function (store) {
        store.delete(key);
        return promisifyRequest(store.transaction);
    });
}

function eachCursor(customStore, callback) {
    return customStore('readonly', function (store) {
        // This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
        // And openKeyCursor isn't supported by Safari.
        store.openCursor().onsuccess = function () {
            if (!this.result) return;
            callback(this.result);
            this.result.continue();
        };

        return promisifyRequest(store.transaction);
    });
}

/**
 * Get all entries in the store. Each entry is an array of `[key, value]`.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */

function entries() {
    var customStore = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultGetStore();
    var items = [];
    return eachCursor(customStore, function (cursor) {
        return items.push([cursor.key, cursor.value]);
    }).then(function () {
        return items;
    });
}

export {
    createStore,
    del,
    entries,
    promisifyRequest
};