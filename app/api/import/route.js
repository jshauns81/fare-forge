import { NextResponse } from 'next/server';
import { insertRecipe } from '@/lib/db';
import { ForgeError, forgeFromText, forgeFromUrl } from '@/lib/extract';

export const maxDuration = 60;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  try {
    let forged;
    if (body?.url) {
      forged = await forgeFromUrl(String(body.url));
    } else if (body?.text) {
      forged = forgeFromText(String(body.text).slice(0, 200_000));
    } else {
      return NextResponse.json({ error: 'Send a url or text to forge.' }, { status: 400 });
    }
    const recipe = insertRecipe(forged.recipe);
    return NextResponse.json({ recipe, report: forged.report });
  } catch (err) {
    if (err instanceof ForgeError) {
      return NextResponse.json({ error: err.message, hint: err.hint }, { status: 422 });
    }
    console.error('forge failed', err);
    return NextResponse.json({ error: 'The Forge hit an unexpected snag.', hint: 'Try pasting the page text instead.' }, { status: 500 });
  }
}
