import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UserDto {
  @ApiProperty({ example: "9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11" })
  id!: string;

  @ApiProperty({ example: "john_doe" })
  username!: string;

  @ApiProperty({ example: "John" })
  firstname!: string;

  @ApiProperty({ example: "Doe" })
  lastname!: string;

  @ApiProperty({ example: "https://example.com/avatar.png" })
  avatar!: string;
}

export class CreateUserDto {
  @ApiProperty({ example: "john_doe" })
  username!: string;

  @ApiProperty({ example: "John" })
  firstname!: string;

  @ApiProperty({ example: "Doe" })
  lastname!: string;

  @ApiProperty({ example: "https://example.com/avatar.png" })
  avatar!: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "john_doe" })
  username?: string;

  @ApiPropertyOptional({ example: "John" })
  firstname?: string;

  @ApiPropertyOptional({ example: "Doe" })
  lastname?: string;

  @ApiPropertyOptional({ example: "https://example.com/avatar.png" })
  avatar?: string;
}

export class UserResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: UserDto })
  data!: UserDto;
}

export class UserListResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: [UserDto] })
  data!: UserDto[];
}

export class DeleteResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: { id: "9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11" } })
  data!: { id: string };
}
