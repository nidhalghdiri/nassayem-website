import { z } from 'zod';

/** Same values as the StaffRole enum in prisma/schema.prisma. */
export const StaffRoleSchema = z.enum([
  'MANAGER',
  'ACCOUNTANT',
  'ADMIN',
  'SUPERVISOR',
  'RECEPTIONIST',
  'HOUSEKEEPING',
  'MAINTENANCE',
  'LAUNDRY',
]);

export const LanguageSchema = z.enum(['en', 'ar']);
export type Language = z.infer<typeof LanguageSchema>;

export const BuildingSchema = z.object({
  id: z.string(),
  shortName: z.string().nullable(),
  nameEn: z.string(),
  nameAr: z.string(),
});

/** Mirrors toMobileUser() in the website's lib/mobileApi.ts. */
export const MobileUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: StaffRoleSchema,
  preferredLanguage: LanguageSchema,
  buildings: z.array(BuildingSchema),
  // Unknown future modules are dropped instead of failing older app builds.
  modules: z.array(z.string()).transform((list) => list.filter((m): m is 'tasks' => m === 'tasks')),
});
export type MobileUser = z.infer<typeof MobileUserSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: MobileUserSchema,
});

export const MeResponseSchema = z.object({ user: MobileUserSchema });

export const ConfigResponseSchema = z.object({ minAppVersion: z.string() });

export const OkResponseSchema = z.object({ ok: z.literal(true) });
