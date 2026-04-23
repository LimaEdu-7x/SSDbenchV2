import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const WS_BASE = (() => {
  try {
    const u = new URL(BACKEND_URL);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}/api`;
  } catch {
    return "/api";
  }
})();

export const api = axios.create({ baseURL: API, timeout: 30000 });

export const fetchDisks = async () => (await api.get("/disks")).data;
export const fetchMeta = async () => (await api.get("/meta")).data;

export const startBenchmark = async (payload) =>
  (await api.post("/benchmark/start", payload)).data;
export const getJob = async (id) => (await api.get(`/benchmark/${id}`)).data;
export const stopJob = async (id) =>
  (await api.post(`/benchmark/${id}/stop`)).data;
export const clearTestFile = async () =>
  (await api.post("/benchmark/clear-test-file")).data;

export const fetchHistory = async () => (await api.get("/history")).data;
export const deleteHistory = async (id) =>
  (await api.delete(`/history/${id}`)).data;
export const exportHistoryUrl = () => `${API}/history/export`;

export function openBenchmarkWS(jobId, handlers) {
  const url = `${WS_BASE}/benchmark/ws/${jobId}`;
  const ws = new WebSocket(url);
  ws.onopen = () => handlers.onOpen && handlers.onOpen();
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      handlers.onEvent && handlers.onEvent(data);
    } catch {
      /* noop */
    }
  };
  ws.onerror = (e) => handlers.onError && handlers.onError(e);
  ws.onclose = () => handlers.onClose && handlers.onClose();
  return ws;
}
