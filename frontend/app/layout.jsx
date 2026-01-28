import "./globals.css";

export const metadata = {
  title: "Travel Planner",
  description: "Chinese travel itinerary planner"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>
    </html>
  );
}
