import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 1800,        // 30 min
  checkperiod: 120,    // Limpia cada 2 min
  useClones: false,
  maxKeys: 1000,        // 200 se saturaba con un solo build del roster (151 pokemon + especies/evoluciones/tipos)
});

cache.on("expired", (key) => console.log(`🗑️ Caché expirado: ${key}`));

export const setCache = (key, value, ttl = 1800) => {
  try {
    return cache.set(key, value, ttl);
  } catch (err) {
    console.warn(`⚠️ No se pudo cachear "${key}" (cache llena): ${err.message}`);
    return false;
  }
};
export const getCache = (key) => cache.get(key);
export const clearCache = () => {
  cache.flushAll();
  console.log("♻️ Caché limpiado manualmente");
};
export const getCacheStats = () => cache.getStats();

export default cache;
