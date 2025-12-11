import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { UserProvider } from '@auth0/nextjs-auth0/client'; // to wrap page with UserProvider
import { ChatBot } from './components/ChatBot';
const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Closet Circle',
  description: 'A fun and sustainable alternative to fast fashion',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <UserProvider>
      <body className={inter.className}>
        {children}
        <ChatBot />
      </body>
      </UserProvider>
    </html>
  )
}
