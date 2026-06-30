// Busca de endereço estilo Google Maps (Places API "searchText" — New).
// Server-side: a chave fica só aqui (GOOGLE_PLACES_API_KEY). Sem chave,
// devolve {configured:false} e o front cai pro modo manual.
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() || '';
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ configured: false, results: [] });
  if (q.length < 3) return NextResponse.json({ configured: true, results: [] });
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.googleMapsUri,places.location',
      },
      body: JSON.stringify({ textQuery: q, languageCode: 'pt-BR', maxResultCount: 6 }),
    });
    const data = await r.json();
    const results = (data.places || []).map((p: any) => ({
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      mapUrl: p.googleMapsUri || (p.location ? `https://maps.google.com/?q=${p.location.latitude},${p.location.longitude}` : ''),
    })).filter((x: any) => x.address);
    return NextResponse.json({ configured: true, results });
  } catch {
    return NextResponse.json({ configured: true, results: [] });
  }
}
