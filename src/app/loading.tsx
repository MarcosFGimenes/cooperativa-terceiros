export default function AppLoading() {
  return (
    <div className="container-page grid place-items-center">
      <div className="card p-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="spinner inline-block"></div>
          <span>Carregando interface…</span>
        </div>
      </div>
    </div>
  );
}
