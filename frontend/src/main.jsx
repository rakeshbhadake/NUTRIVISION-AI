import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { MealReminderBridge } from "./contexts/PreferencesContext";
import App from "./App";
import "./index.css";

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: true },
  },
});
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={client}>
    <BrowserRouter>
      <AuthProvider>
        <MealReminderBridge />
        <App />
        <Toaster position="bottom-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);
