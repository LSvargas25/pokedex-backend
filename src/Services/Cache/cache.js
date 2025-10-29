import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 1800,        // 30 min
  checkperiod: 120,    // Limpia cada 2 min
  useClones: false,
  maxKeys: 200,
});

cache.on("expired", (key) => console.log(`🗑️ Caché expirado: ${key}`));

export const setCache = (key, value, ttl = 1800) => cache.set(key, value, ttl);
export const getCache = (key) => cache.get(key);
export const clearCache = () => {
  cache.flushAll();
  console.log("♻️ Caché limpiado manualmente");
};
export const getCacheStats = () => cache.getStats();

export default cache;
