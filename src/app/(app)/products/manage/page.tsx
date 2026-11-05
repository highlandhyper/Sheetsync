import { redirect } from 'next/navigation';

export default async function ManageProductPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string | string[] }>;
}) {
  const params = await searchParams;
  const barcode = Array.isArray(params.barcode) ? params.barcode[0] : params.barcode;
  const query = new URLSearchParams({ tab: 'manage' });

  if (barcode) query.set('barcode', barcode);

  redirect(`/products/list?${query.toString()}`);
}
