const DB_NAME = "leaguehub-db";
const DB_VERSION = 1;

let dbInstance = null;
let dbStatus = "connecting";

function emitStatus() {
  document.dispatchEvent(new CustomEvent("db:status", { detail: { status: dbStatus } }));
}

// Envuelve un request de IndexedDB en una promesa manteniendo la transacción viva.
function idbQ(store, method, ...args) {
  return new Promise((resolve, reject) => {
    const req = store[method](...args);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Consulta un store por índice dentro de una transacción abierta.
function idbQIndex(store, indexName, value) {
  return new Promise((resolve, reject) => {
    const req = store.index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Borra todos los registros de un store cuyo índice coincida con el valor
// (cursor dentro de una transacción abierta).
function idbDeleteByIndex(store, indexName, value) {
  return new Promise((resolve, reject) => {
    const req = store.index(indexName).openCursor(value);
    const pending = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        pending.push(
          new Promise((res, rej) => {
            const del = cursor.delete();
            del.onsuccess = () => res();
            del.onerror = () => rej(del.error);
          }),
        );
        cursor.continue();
      } else {
        Promise.all(pending).then(resolve).catch(reject);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

class DB {
  async #getStore(mode, storeName) {
    const db = await this.open();
    const tx = db.transaction(storeName, mode);
    return { tx, store: tx.objectStore(storeName) };
  }

  async #upgradeDB(event) {
    const db = event.target.result;
    const configs = {
      leagues: { indexes: ["name", "isActive"] },
      teams: { indexes: ["leagueId", "name"] },
      players: { indexes: ["teamId", "name"] },
      matches: { indexes: ["leagueId", "homeTeamId", "awayTeamId", "date", "status"] },
      events: { indexes: ["matchId", "playerId"] },
    };

    for (const [name, cfg] of Object.entries(configs)) {
      if (db.objectStoreNames.contains(name)) continue;
      const store = db.createObjectStore(name, { keyPath: "id", autoIncrement: true });
      for (const idx of cfg.indexes) {
        // leagues.name must be unique
        const unique = idx === "name" && name === "leagues";
        store.createIndex(idx, idx, { unique });
      }
    }
  }

  async open() {
    if (dbInstance) return dbInstance;
    dbInstance = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => this.#upgradeDB(e);
      req.onsuccess = () => {
        dbStatus = "connected";
        emitStatus();
        resolve(req.result);
      };
      req.onerror = () => {
        dbInstance = null;
        dbStatus = "error";
        emitStatus();
        reject(req.error);
      };
    });

    return dbInstance;
  }

  getConnectionStatus() {
    return dbStatus;
  }

  async getAll(storeName) {
    const { store } = await this.#getStore("readonly", storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getById(storeName, id) {
    const { store } = await this.#getStore("readonly", storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    const { store } = await this.#getStore("readonly", storeName);
    return new Promise((resolve, reject) => {
      const req = store.index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async add(storeName, data) {
    const { store } = await this.#getStore("readwrite", storeName);
    return new Promise((resolve, reject) => {
      const req = store.add(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, data) {
    const { store } = await this.#getStore("readwrite", storeName);
    return new Promise((resolve, reject) => {
      const req = store.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async remove(storeName, id) {
    const { store } = await this.#getStore("readwrite", storeName);
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Borra todos los registros de un store cuyo índice coincida con el valor.
  // Usado por las operaciones en cascada (eliminar liga, etc.).
  async removeByIndex(storeName, indexName, value) {
    const { store } = await this.#getStore("readwrite", storeName);
    return new Promise((resolve, reject) => {
      const req = store.index(indexName).openCursor(value);
      const pending = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          pending.push(
            new Promise((res, rej) => {
              const del = cursor.delete();
              del.onsuccess = () => res();
              del.onerror = () => rej(del.error);
            }),
          );
          cursor.continue();
        } else {
          Promise.all(pending).then(resolve).catch(reject);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    const { store } = await this.#getStore("readwrite", storeName);
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async runTransaction(storeNames, mode, callback) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      const stores = {};
      storeNames.forEach((n) => {
        stores[n] = tx.objectStore(n);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
      tx.onabort = (e) => reject(e.target.error);
      // Si el callback lanza un error (validación, lógica), se aborta la
      // transacción para revertir todo y se propaga el error al caller.
      Promise.resolve()
        .then(() => callback(stores, tx))
        .catch((err) => {
          try {
            tx.abort();
          } catch {
            /* transacción ya finalizada */
          }
          reject(err);
        });
    });
  }

  getActiveLeagueId() {
    return localStorage.getItem("leaguehub-active-league") || null;
  }

  setActiveLeagueId(id) {
    if (id) localStorage.setItem("leaguehub-active-league", id);
    else localStorage.removeItem("leaguehub-active-league");
  }

  /**
   * Elimina una liga y todos sus datos asociados (equipos, jugadores,
   * partidos y eventos) en una sola transacción. Si la liga eliminada era
   * la activa, la siguiente liga disponible pasa a ser la activa.
   *
   * @returns {Promise<{activeChanged: boolean, nextActiveId: number|null}>}
   */
  async deleteLeagueCascade(leagueId) {
    const result = { activeChanged: false, nextActiveId: null };

    await this.runTransaction(
      ["leagues", "teams", "players", "matches", "events"],
      "readwrite",
      async (stores) => {
        const league = await idbQ(stores.leagues, "get", leagueId);
        if (!league) throw new Error("La liga no existe.");

        // 1) Eventos de los partidos de la liga.
        const matches = await idbQIndex(stores.matches, "leagueId", leagueId);
        for (const m of matches) {
          await idbDeleteByIndex(stores.events, "matchId", m.id);
        }

        // 2) Partidos.
        await idbDeleteByIndex(stores.matches, "leagueId", leagueId);

        // 3) Jugadores de los equipos de la liga.
        const teams = await idbQIndex(stores.teams, "leagueId", leagueId);
        for (const t of teams) {
          await idbDeleteByIndex(stores.players, "teamId", t.id);
        }

        // 4) Equipos.
        await idbDeleteByIndex(stores.teams, "leagueId", leagueId);

        // 5) La liga.
        await idbQ(stores.leagues, "delete", leagueId);

        // Si la liga eliminada era la activa, la siguiente pasa a serlo.
        const wasActive = league.isActive || Number(this.getActiveLeagueId()) === leagueId;
        if (wasActive) {
          const remaining = await idbQ(stores.leagues, "getAll");
          const next = remaining[0] || null;
          if (next) {
            await idbQ(stores.leagues, "put", { ...next, isActive: true });
          }
          result.activeChanged = true;
          result.nextActiveId = next ? next.id : null;
        }
      },
    );

    return result;
  }
}

const db = new DB();
export default db;
