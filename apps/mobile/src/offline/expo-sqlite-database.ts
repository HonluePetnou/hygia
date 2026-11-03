import type { SQLiteDatabase } from 'expo-sqlite';
import type { SqlDatabase, SqlValue } from './sql-database.js';

/** Adaptateur `expo-sqlite` du port `SqlDatabase` (base de l'appareil). */
export class ExpoSqlDatabase implements SqlDatabase {
  constructor(private readonly db: SQLiteDatabase) {}

  exec(sql: string): Promise<void> {
    return this.db.execAsync(sql);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    await this.db.runAsync(sql, [...params]);
  }

  all<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, [...params]);
  }
}
