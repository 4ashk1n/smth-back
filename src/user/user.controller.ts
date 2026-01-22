import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateUserSchema, UpdateUserSchema } from "./user.schemas";
import { UserService } from "./user.service";
import { CreateUserDto, DeleteResponse, UpdateUserDto, UserListResponse, UserResponse } from "./user.swagger";

type CreateDto = z.infer<typeof CreateUserSchema>;
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

  @Post()
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ type: UserResponse })
  create(@Body(new ZodValidationPipe(asZodType(CreateUserSchema))) dto: CreateDto) {
    return this.userService.create(dto);
  }

  @Patch(":id")
  @ApiParam({ name: "id", type: String })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserResponse })
  update(@Param("id") id: string, @Body(new ZodValidationPipe(asZodType(UpdateUserSchema))) dto: UpdateDto) {
    return this.userService.update(id, dto);
  }

  @Delete(":id")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ type: DeleteResponse })
  remove(@Param("id") id: string) {
    return this.userService.remove(id);
  }
}
