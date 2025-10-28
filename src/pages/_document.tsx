import NextDocument, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
  DocumentInitialProps,
} from "next/document";

import FirebaseConfigScript from "@/components/FirebaseConfigScript";
import PreloadAsFix from "@/components/PreloadAsFix";

// Introduced custom Document to centralize <Html>/<Head>/<Main>/<NextScript> and prevent hydration mismatches.
type ThemeMode = "light" | "dark";

type ThemeDocumentProps = DocumentInitialProps & {
  theme: ThemeMode;
};

export default function Document({ theme }: ThemeDocumentProps) {
  return (
    <Html lang="pt-BR" data-theme={theme} className={theme === "dark" ? "dark" : undefined}>
      <Head>
        <PreloadAsFix />
        <FirebaseConfigScript />
      </Head>
      <body className="relative bg-background text-foreground">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

Document.getInitialProps = async (
  ctx: DocumentContext,
): Promise<ThemeDocumentProps> => {
  const initialProps = await NextDocument.getInitialProps(ctx);
  const cookieHeader = ctx.req?.headers.cookie ?? "";
  const themeMatch = cookieHeader.match(/(?:^|;\s*)theme=(dark|light)/);
  const theme = (themeMatch?.[1] as ThemeMode | undefined) ?? "light";

  return {
    ...initialProps,
    theme,
  };
};
