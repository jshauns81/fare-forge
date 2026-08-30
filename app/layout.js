import './globals.css';

export const metadata = {
  title: {
    default: 'Fare Forge',
    template: '%s · Fare Forge',
  },
  description: 'Melt down the blog post. Keep the recipe. A family weekly meal planner.',
};

export const viewport = {
  themeColor: '#292420',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
