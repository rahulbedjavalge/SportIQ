export const metadata = {
  title: "SportIQ – Your AI Sports Companion",
  description: "Smart Q&A chatbot for sports results and info"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
