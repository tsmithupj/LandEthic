import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { properties, tasks } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the property row if it belongs to `clerkUserId`, otherwise null. */
export async function getOwnedProperty(clerkUserId: string, propertyId: string) {
  if (typeof propertyId !== 'string' || !UUID.test(propertyId)) return null; // not an id → not found (not a crash)
  const [row] = await getDb()
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId));
  if (!row || row.clerkUserId !== clerkUserId) return null;
  return row;
}

/** Returns the task row if its property belongs to `clerkUserId`, otherwise null. */
export async function getOwnedTask(clerkUserId: string, taskId: string) {
  if (typeof taskId !== 'string' || !UUID.test(taskId)) return null;
  const [row] = await getDb()
    .select({ task: tasks, ownerId: properties.clerkUserId })
    .from(tasks)
    .innerJoin(properties, eq(tasks.propertyId, properties.id))
    .where(eq(tasks.id, taskId));
  if (!row || row.ownerId !== clerkUserId) return null;
  return row.task;
}
