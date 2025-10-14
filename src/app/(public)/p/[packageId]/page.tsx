import PackageClient from "./PackageClient";

type PageProps = {
  params: Promise<{ packageId: string }>;
  searchParams?: Promise<{ token?: string }>;
};

export const dynamic = "force-dynamic";

export default async function PackagePage({ params, searchParams }: PageProps) {
  const { packageId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const token =
    typeof resolvedSearchParams?.token === "string" ? resolvedSearchParams.token : "";
  return <PackageClient packageId={packageId} token={token} />;
}
