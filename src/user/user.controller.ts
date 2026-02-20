import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { UpdateUserSchema } from "./user.schemas";
import { UserService } from "./user.service";
import { UpdateUserDto, UserListResponse, UserResponse } from "./user.swagger";

type UpdateDto = z.infer<typeof UpdateUserSchema>;

type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;

@Controller("users")
@ApiTags("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOkResponse({ type: UserListResponse })
  list() {
    return this.userService.list();
  }

  @Get(":id")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ type: UserResponse })
  getById(@Param("id") id: string) {
    return this.userService.getById(id);
  }

  @Patch(":id")
  @ApiParam({ name: "id", type: String })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserResponse })
  update(@Param("id") id: string, @Body(new ZodValidationPipe(asZodType(UpdateUserSchema))) dto: UpdateDto) {
    return this.userService.update(id, dto);
  }
}
