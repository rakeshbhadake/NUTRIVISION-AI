import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, refreshSession } from "../services/api";

export function useRealtime(user) {
  const client = useQueryClient();
  useEffect(() => {
    if (!user) return;
    let socket,
      timer,
      stopped = false,
      delay = 2000;
    const connect = () => {
      const base =
        import.meta.env.VITE_WS_URL ||
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/nutrition/`;
      socket = new WebSocket(base);
      socket.onopen = () => {
        delay = 2000;
        socket.send(
          JSON.stringify({ type: "authenticate", token: getToken() }),
        );
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "nutrition.updated")
            ["daily", "weekly", "analytics", "meals", "water"].forEach((key) =>
              client.invalidateQueries({ queryKey: [key] }),
            );
        } catch {
          /* Ignore malformed transport messages. */
        }
      };
      socket.onclose = async (event) => {
        if (stopped) return;
        if (event.code === 4401) {
          try {
            await refreshSession();
          } catch {
            window.dispatchEvent(new Event("auth-expired"));
            return;
          }
        }
        if (!stopped) {
          timer = setTimeout(connect, delay);
          delay = Math.min(delay * 2, 60000);
        }
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [user?.id, client]);
}
