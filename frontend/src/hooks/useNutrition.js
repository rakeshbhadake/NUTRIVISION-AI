import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { localDate } from "../utils/nutrition";
export const useDaily = (date = localDate()) =>
  useQuery({
    queryKey: ["daily", date],
    queryFn: async () =>
      (await api.get("/nutrition/daily/", { params: { date } })).data,
  });
export const useWeekly = () =>
  useQuery({
    queryKey: ["weekly"],
    queryFn: async () => (await api.get("/nutrition/weekly/")).data,
  });
export function useInvalidateNutrition() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      ["daily", "weekly", "monthly", "meals", "analytics", "water"].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
}
