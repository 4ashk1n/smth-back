import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CategoryColorsDto {
  @ApiProperty({ example: "#ffffff" })
  lightColor!: string;

  @ApiProperty({ example: "#111111" })
  darkColor!: string;

  @ApiProperty({ example: "#ff6600" })
  accentColor!: string;
}

export class CategoryDto {
  @ApiProperty({ example: "9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11" })
  id!: string;

  @ApiProperty({ example: "Tech" })
  name!: string;

  @ApiProperty({ example: "💻" })
  emoji!: string;

  @ApiProperty({ type: CategoryColorsDto })
  colors!: CategoryColorsDto;
}

export class CreateCategoryDto {
  @ApiProperty({ example: "Tech" })
  name!: string;

  @ApiProperty({ example: "💻" })
  emoji!: string;

  @ApiProperty({ type: CategoryColorsDto })
  colors!: CategoryColorsDto;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: "Tech" })
  name?: string;

  @ApiPropertyOptional({ example: "💻" })
  emoji?: string;

  @ApiPropertyOptional({ type: CategoryColorsDto })
  colors?: CategoryColorsDto;
}

export class CategoryResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: CategoryDto })
  data!: CategoryDto;
}

export class CategoryListResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: [CategoryDto] })
  data!: CategoryDto[];
}

export class DeleteResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: { id: "9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11" } })
  data!: { id: string };
}
