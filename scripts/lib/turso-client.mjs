function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeStatement(statement) {
  if (typeof statement === 'string') return statement;
  return {
    sql: statement.sql,
    args: statement.args || []
  };
}

export async function createTursoClient() {
  const url = requiredEnv('TURSO_DATABASE_URL');
  const authToken = requiredEnv('TURSO_AUTH_TOKEN');

  if (url.startsWith('turso://')) {
    const { connect } = await import('@tursodatabase/serverless');
    const connection = connect({ url, authToken });

    return {
      flavor: 'turso',
      url,
      async query(sql, args = []) {
        const statement = connection.prepare(sql);
        return statement.all(args);
      },
      async run(sql, args = []) {
        const statement = connection.prepare(sql);
        return statement.run(args);
      },
      async batch(statements) {
        return connection.batch(statements.map(normalizeStatement), 'immediate');
      }
    };
  }

  if (url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('http://')) {
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url, authToken });

    return {
      flavor: 'libsql',
      url,
      async query(sql, args = []) {
        const result = await client.execute({ sql, args });
        return result.rows;
      },
      async run(sql, args = []) {
        return client.execute({ sql, args });
      },
      async batch(statements) {
        return client.batch(statements.map(normalizeStatement), 'write');
      }
    };
  }

  throw new Error(
    `Unsupported TURSO_DATABASE_URL scheme: ${url.split(':', 1)[0] || '(unknown)'}. ` +
    'Expected turso:// for Turso Database or libsql:// / https:// for libSQL.'
  );
}
