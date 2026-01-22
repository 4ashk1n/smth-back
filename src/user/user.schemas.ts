import { CreateUserSchema, UpdateUserSchema, UserSchema } from "@smth/shared";
import { z } from "zod";

export { CreateUserSchema, UpdateUserSchema, UserSchema };

export type UserDto = z.infer<typeof UserSchema>;
type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodTypeAny;

export const UserDtoSchema = asZodType(UserSchema);
