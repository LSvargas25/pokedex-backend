import axios from "axios";
import pLimit from "p-limit";

// Todo acceso en vivo a PokeAPI pasa por aquí: Render (plan free, 0.1 CPU) no
// aguanta cientos de requests simultáneas, y una llamada colgada no debe
// bloquear la respuesta para siempre.
export const POKEAPI_BASE = "https://pokeapi.co/api/v2";
export const POKEAPI_TIMEOUT_MS = 8000;
export const POKEAPI_CONCURRENCY = 10;
export const POKEAPI_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 300;

const limit = pLimit(POKEAPI_CONCURRENCY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Errores de red, timeouts, 429 y 5xx se reintentan; un 404 no va a cambiar.
const isRetryable = (err) => {
  const status = err.response?.status;
  return status === undefined || status === 429 || status >= 500;
};

/** GET a PokeAPI con timeout, concurrencia limitada y reintentos con backoff. */
export const pokeApiGet = (pathOrUrl) => {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${POKEAPI_BASE}${pathOrUrl}`;

  return limit(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const { data } = await axios.get(url, { timeout: POKEAPI_TIMEOUT_MS });
        return data;
      } catch (err) {
        if (attempt >= POKEAPI_RETRIES || !isRetryable(err)) throw err;
        await sleep(RETRY_BASE_DELAY_MS * 3 ** attempt); // 300 ms, 900 ms
      }
    }
  });
};
