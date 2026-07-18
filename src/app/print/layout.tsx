export default function PrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#e5e7eb' }}>
        {children}
      </body>
    </html>
  )
}