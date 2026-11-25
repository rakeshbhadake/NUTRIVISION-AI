import { useEffect } from "react";
import { useAuth } from "./AuthContext.jsx";

// Browser reminders run only while the app is open. Server push is a separate integration.
export function MealReminderBridge() {
  const { user } = useAuth();
  useEffect(() => {
    const profile = user?.profile;
    if (
      !user?.id ||
      !profile?.reminder_enabled ||
      !profile?.reminder_time ||
      !("Notification" in window)
    )
      return;
    function checkReminder() {
      if (Notification.permission !== "granted") return;
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: profile.timezone || "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(new Date());
        const values = Object.fromEntries(
          parts.map((part) => [part.type, part.value]),
        );
        const day = `${values.year}-${values.month}-${values.day}`;
        const time = `${values.hour}:${values.minute}`;
        const key = `nutrivision-reminder-${user.id}`;
        if (
          time !== profile.reminder_time.slice(0, 5) ||
          localStorage.getItem(key) === day
        )
          return;
        const notification = new Notification(
          profile.locale === "hi"
            ? "भोजन दर्ज करने का समय"
            : "A little moment for your nutrition",
          {
            body:
              profile.locale === "hi"
                ? "अपना भोजन दर्ज करें और अपनी प्रगति देखें।"
                : "Take a moment to log your meal and check in with your daily progress.",
            tag: "nutrivision-meal-reminder",
          },
        );
        notification.onclick = () => {
          window.focus();
          window.location.assign("/tracker");
          notification.close();
        };
        localStorage.setItem(key, day);
      } catch {
        /* Invalid system time zone or disabled browser notifications. */
      }
    }
    checkReminder();
    const interval = window.setInterval(checkReminder, 30000);
    return () => window.clearInterval(interval);
  }, [user]);
  return null;
}
