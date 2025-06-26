import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lilo - 诗语共创",
  description: "与好友一起创作拼贴诗，上传图片，实时协作，分享美好创意",
  keywords: "创意协作,诗歌创作,图片识别,文字拼贴,实时同步",
  authors: [{ name: "Lilo Team" }],
  openGraph: {
    title: "Lilo - 诗语共创",
    description: "与好友一起创作拼贴诗，上传图片，实时协作，分享美好创意",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
