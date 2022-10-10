import { gaId } from "./const";
import type { Event } from "../types/ga";

export const pageview = (path: string) => {
  window.gtag("config", gaId, {
    page_path: path,
  });
};

export const event = ({action, category, label}: Event) => {
  window.gtag("event", action, {
    event_category: category,
    event_label: JSON.stringify(label),
    value: "",
  });
};
