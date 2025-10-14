export default function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto flex h-12 items-center justify-between px-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} PCM Terceiros</p>
        <p>Feito com Next.js + Tailwind</p>
      </div>
    </footer>
  );
}
