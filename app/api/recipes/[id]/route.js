import { NextResponse } from 'next/server';
import { deleteRecipe, getRecipe } from '@/lib/db';

export async function DELETE(_req, { params }) {
  const { id } = await params;
  const recipe = getRecipe(id);
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  deleteRecipe(id);
  return NextResponse.json({ ok: true });
}
