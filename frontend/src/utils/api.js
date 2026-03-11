import axios from "axios";

const api = axios.create({ baseURL: "/api", headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bupulse_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && err.response?.data?.code === "TOKEN_EXPIRED") {
      localStorage.removeItem("bupulse_token");
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

export default api;
