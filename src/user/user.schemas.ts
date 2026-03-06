import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  avatar: z.string(),
  email: z.email().nullable(),
  provider: z.string().nullable(),
});

export const UpdateUserSchema = z
  .object({
    firstname: z.string().min(1).optional(),
    lastname: z.string().min(1).optional(),
    avatar: z.url().or(z.literal("")).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field should be provided",
  });

export type UserDto = z.infer<typeof UserSchema>;
export const UserDtoSchema = UserSchema;
