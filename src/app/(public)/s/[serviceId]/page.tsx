import ServiceClient from "./ServiceClient";

type PageProps = {
  params: Promise<{ serviceId: string }>;
  searchParams?: Promise<{ token?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ServicePage({ params, searchParams }: PageProps) {
  const { serviceId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const token =
    typeof resolvedSearchParams?.token === "string" ? resolvedSearchParams.token : "";
  return <ServiceClient serviceId={serviceId} token={token} />;
}
