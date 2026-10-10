import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

// The production connection is supplied privately by the Vercel integration.
if (!process.env.DATABASE_URL) {
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('La connexion à la base de production est manquante.');
  }
  console.log('Migration ignorée : aucune base configurée pour cet environnement.');
} else {
  const source = await readFile(new URL('../migrations/vercel/001_remobia.sql', import.meta.url), 'utf8');
  // This controlled migration contains no semicolons within SQL string literals.
  const statements = source.split(';').map(value => value.trim())
    .filter(value => value && !/^(BEGIN|COMMIT)$/i.test(value));
  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql.transaction(statements.map(statement => sql.query(statement)), {
      fetchOptions: { signal: AbortSignal.timeout(30000) },
    });
    console.log('Base REMOBIA prête : schéma vérifié dans une transaction.');
  } catch {
    // Provider errors can contain connection details. Keep deployment logs clean.
    throw new Error('La préparation de la base REMOBIA a échoué. Le déploiement est arrêté.');
  }
}
