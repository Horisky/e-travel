import "./globals.css";
import { LanguageProvider } from "./components/LanguageProvider";
import LanguageToggle from "./components/LanguageToggle";

export const metadata = {
  title: "Travel Planner",
  description: "Chinese travel itinerary planner"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <LanguageProvider>
          <LanguageToggle />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
