import PackageClient from "./PackageClient";

type PageProps = {
  params: { packageId: string };
  searchParams?: { token?: string };
};

export const dynamic = "force-dynamic";

export default function PackagePage({ params, searchParams }: PageProps) {
  const token = typeof searchParams?.token === "string" ? searchParams.token : "";
  return <PackageClient packageId={params.packageId} token={token} />;
}
